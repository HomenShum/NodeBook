import { AgentContextNode } from "./workflowAgent";

export type SemanticContextResult = {
  status: "ready" | "degraded";
  reason?: string;
  model: string;
  indexedCount: number;
  nodes: Array<AgentContextNode & { semanticScore: number }>;
};

export function fuseRetrievedContext(
  primary: AgentContextNode[],
  semantic: SemanticContextResult,
  limit: number,
) {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const merged = new Map<string, AgentContextNode & { semanticScore?: number }>();
  for (const node of primary) merged.set(node.sourceId, { ...node, retrievalSignals: [...new Set(node.retrievalSignals ?? [])].sort() });
  for (const node of semantic.nodes) {
    const existing = merged.get(node.sourceId);
    merged.set(node.sourceId, {
      ...(existing ?? node),
      semanticScore: node.semanticScore,
      retrievalSignals: [...new Set([...(existing?.retrievalSignals ?? []), ...(node.retrievalSignals ?? []), "semantic"])].sort(),
    });
  }

  const lexicalAnchors = primary
    .filter((node) => (node.retrievalSignals ?? []).some((signal) => signal === "current_node" || signal === "full_text"))
    .slice(0, 16);
  const orderedIds = [...lexicalAnchors, ...semantic.nodes, ...primary].map((node) => node.sourceId);
  const seen = new Set<string>();
  return orderedIds
    .filter((sourceId) => !seen.has(sourceId) && Boolean(seen.add(sourceId)))
    .map((sourceId) => merged.get(sourceId)!)
    .slice(0, boundedLimit);
}
