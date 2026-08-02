import type { AgentMemory, AgentOperation } from "@/app/query/types";

export const MAX_MEMORY_PROJECTION_SOURCES = 12;
const MAX_MEMORY_PROJECTION_CONTENT = 10_000;

export type MemoryProjectionNode = {
  sourceId: string;
  version: number;
  contentText: string;
  document: string;
  updatedAt: string;
};

function compact(value: string, limit: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function titleFor(node: MemoryProjectionNode) {
  return compact(node.contentText.split(/\r?\n/, 1)[0] || "Untitled note", 120);
}

export function buildMemoryProjection(args: {
  memory: AgentMemory;
  rootNodeId: string;
  nodes: MemoryProjectionNode[];
}) {
  const byId = new Map(args.nodes.map((node) => [node.sourceId, node]));
  if (!byId.has(args.rootNodeId)) throw new Error("MEMORY_PROJECTION_ROOT_NOT_FOUND");

  const sourceNodes = [...new Set(args.memory.sourceNodeIds)]
    .filter((sourceId) => sourceId !== args.rootNodeId)
    .map((sourceId) => byId.get(sourceId))
    .filter((node): node is MemoryProjectionNode => Boolean(node))
    .slice(0, MAX_MEMORY_PROJECTION_SOURCES);
  const tools = args.memory.toolSequence.slice(0, 12).map((tool) => compact(tool, 80));
  const evidenceTitles = sourceNodes.map(titleFor);
  const content = [
    "🧠 NodeAgent Memory",
    compact(args.memory.summary, 2_000),
    "",
    `Original request: ${compact(args.memory.query, 1_000)}`,
    `Task: ${compact(args.memory.taskClass, 80)} · Outcome: ${args.memory.outcome}`,
    `Tools: ${tools.join(" → ") || "no tools"}`,
    `Recorded: ${compact(args.memory.createdAt, 80)} · Duration: ${Math.max(0, Math.round(args.memory.durationMs))} ms`,
    `Evidence (${evidenceTitles.length}): ${evidenceTitles.join("; ") || "none"}`,
  ].join("\n").slice(0, MAX_MEMORY_PROJECTION_CONTENT);

  const tempId = "typed-memory-projection";
  const operations: AgentOperation[] = [
    {
      kind: "create_node",
      nodeId: null,
      parentId: args.rootNodeId,
      newParentId: null,
      fromNodeId: null,
      toNodeId: null,
      relationType: null,
      tempId,
      content,
      newContent: null,
      reason: "Project one inspected typed memory into the current notebook.",
    },
    ...sourceNodes.map((node): AgentOperation => ({
      kind: "add_relation",
      nodeId: null,
      parentId: null,
      newParentId: null,
      fromNodeId: tempId,
      toNodeId: node.sourceId,
      relationType: "relatedTo",
      tempId: null,
      content: null,
      newContent: null,
      reason: "Link the projected memory to one exact cited notebook source.",
    })),
  ];

  return { content, operations, sourceNodes };
}
