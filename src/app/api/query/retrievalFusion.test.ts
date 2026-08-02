import { fuseRetrievedContext, SemanticContextResult } from "./retrievalFusion";

const node = (sourceId: string, retrievalSignals: string[] = ["lexical"]) => ({
  sourceId,
  version: 1,
  contentText: sourceId,
  document: JSON.stringify({ id: sourceId }),
  updatedAt: "2026-08-02T00:00:00.000Z",
  retrievalSignals,
});

describe("NodeAgent hybrid retrieval fusion", () => {
  test("a founder using a conceptual query receives a semantic-only note without losing the exact current-root anchor", () => {
    const semantic: SemanticContextResult = {
      status: "ready",
      model: "text-embedding-3-small",
      indexedCount: 1,
      nodes: [{ ...node("retention-evidence", ["semantic"]), semanticScore: 0.82 }],
    };
    const rows = fuseRetrievedContext([
      node("current-root", ["current_node"]),
      node("exact-launch", ["full_text"]),
      node("lexical-only"),
    ], semantic, 40);

    expect(rows.map((row) => row.sourceId)).toEqual([
      "current-root",
      "exact-launch",
      "retention-evidence",
      "lexical-only",
    ]);
    expect(rows.find((row) => row.sourceId === "retention-evidence")?.retrievalSignals).toContain("semantic");
  });

  test("a note found by both exact and semantic retrieval is deduplicated with transparent combined signals", () => {
    const semantic: SemanticContextResult = {
      status: "ready",
      model: "text-embedding-3-small",
      indexedCount: 0,
      nodes: [{ ...node("same-note", ["semantic"]), semanticScore: 0.91 }],
    };
    const rows = fuseRetrievedContext([node("same-note", ["full_text", "current_node"])], semantic, 40);
    expect(rows).toHaveLength(1);
    expect(rows[0].retrievalSignals).toEqual(["current_node", "full_text", "semantic"]);
  });

  test("a knowledge-map run keeps its bounded cluster evidence ahead of general retrieval context", () => {
    const semantic: SemanticContextResult = {
      status: "ready",
      model: "text-embedding-3-small",
      indexedCount: 0,
      nodes: [{ ...node("semantic-general", ["semantic"]), semanticScore: 0.91 }],
    };
    const rows = fuseRetrievedContext([
      node("large-lexical-anchor", ["full_text"]),
      node("cluster-a", ["semantic_cluster"]),
      node("cluster-b", ["semantic_cluster"]),
    ], semantic, 40);

    expect(rows.map((row) => row.sourceId)).toEqual([
      "cluster-a",
      "cluster-b",
      "large-lexical-anchor",
      "semantic-general",
    ]);
  });

  test("a noisy sustained notebook cannot expand provider context beyond the mode bound", () => {
    const semantic: SemanticContextResult = {
      status: "ready",
      model: "text-embedding-3-small",
      indexedCount: 24,
      nodes: Array.from({ length: 40 }, (_, index) => ({ ...node(`semantic-${index}`, ["semantic"]), semanticScore: 0.8 - index / 100 })),
    };
    const primary = Array.from({ length: 200 }, (_, index) => node(`lexical-${index}`));
    expect(fuseRetrievedContext(primary, semantic, 40)).toHaveLength(40);
  });
});
