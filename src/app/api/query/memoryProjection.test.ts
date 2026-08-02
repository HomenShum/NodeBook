import { buildMemoryProjection, MAX_MEMORY_PROJECTION_SOURCES, MemoryProjectionNode } from "./memoryProjection";

function node(sourceId: string, contentText = sourceId): MemoryProjectionNode {
  return { sourceId, version: 1, contentText, document: JSON.stringify({ sourceId }), updatedAt: "2026-08-02T00:00:00.000Z" };
}

const memory = {
  memoryId: "run:research-1",
  traceId: "research-1",
  taskClass: "research",
  summary: "Compared launch evidence across the reviewed notebook.",
  query: "Compare the launch evidence I already captured.",
  toolSequence: ["find_nodes", "find_related_nodes_via_graph", "finish_work"],
  outcome: "success" as const,
  sourceNodeIds: Array.from({ length: 20 }, (_, index) => `source-${index}`),
  pinned: false,
  durationMs: 1250,
  createdAt: "2026-08-02T00:00:00.000Z",
};

describe("typed-memory graph projection", () => {
  test("a researcher projects one readable node with at most 12 exact source relations", () => {
    const projection = buildMemoryProjection({
      memory,
      rootNodeId: "root",
      nodes: [node("root", "Notebook"), ...memory.sourceNodeIds.map((id, index) => node(id, `Evidence ${index}\nDetails`))],
    });

    expect(projection.sourceNodes).toHaveLength(MAX_MEMORY_PROJECTION_SOURCES);
    expect(projection.operations).toHaveLength(MAX_MEMORY_PROJECTION_SOURCES + 1);
    expect(projection.operations[0]).toEqual(expect.objectContaining({ kind: "create_node", parentId: "root", tempId: "typed-memory-projection" }));
    expect(projection.operations.slice(1).every((operation) => operation.kind === "add_relation"
      && operation.fromNodeId === "typed-memory-projection"
      && operation.relationType === "relatedTo")).toBe(true);
    expect(projection.content).toContain("Original request: Compare the launch evidence I already captured.");
    expect(projection.content).toContain("Evidence (12): Evidence 0");
  });

  test("a stale current root fails closed before producing graph operations", () => {
    expect(() => buildMemoryProjection({ memory, rootNodeId: "missing-root", nodes: [node("source-0")] }))
      .toThrow("MEMORY_PROJECTION_ROOT_NOT_FOUND");
  });

  test("duplicate, missing, oversized, and negative inputs stay deterministic and bounded", () => {
    const adversarial = {
      ...memory,
      summary: "x".repeat(20_000),
      query: "q".repeat(20_000),
      durationMs: -999,
      sourceNodeIds: ["root", "source-1", "source-1", "missing", ...memory.sourceNodeIds],
      toolSequence: Array.from({ length: 40 }, (_, index) => `tool-${index}-${"x".repeat(200)}`),
    };
    const nodes = [node("root"), ...memory.sourceNodeIds.map((id) => node(id, `${"T".repeat(300)}\nsecret body`))];
    const first = buildMemoryProjection({ memory: adversarial, rootNodeId: "root", nodes });
    const second = buildMemoryProjection({ memory: adversarial, rootNodeId: "root", nodes: [...nodes].reverse() });

    expect(first).toEqual(second);
    expect(first.content.length).toBeLessThanOrEqual(10_000);
    expect(first.content).toContain("Duration: 0 ms");
    expect(first.sourceNodes.map((item) => item.sourceId)).toEqual([...new Set(adversarial.sourceNodeIds)]
      .filter((id) => id !== "root" && id !== "missing")
      .slice(0, MAX_MEMORY_PROJECTION_SOURCES));
  });
});
