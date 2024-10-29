import { useCallback } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { Match } from "@/app/editor/plugins/dropdown/types";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphRelationType } from "@/app/graph/types";

export type NodeType = "node" | "relation" | "relationType";

export interface FilterBy {
  nodeId?: string;
  relationTypeId?: string;
}

type GetMatches = (text: string, types?: NodeType[]) => Match[];

// Define the type for nodes and relations
type NodeResult = { node: GraphNode; score: number };
type RelationResult = { relation: GraphRelation; score: number };
type RelationTypeResult = { relationType: GraphRelationType; score: number };

export function getMatches(
  graphStore: GraphStore,
  text: string,
  types: NodeType[] | undefined,
  toFilterBy: FilterBy,
  maxResults: number,
): Match[] {
  text = text.toLocaleLowerCase().trim();
  const results = graphStore.search({ text, filters: { types } });

  if (toFilterBy.nodeId) {
    results.nodes = results.nodes.filter(({ node }: { node: GraphNode }) => node.id !== toFilterBy.nodeId);
    results.relations = results.relations.filter(
      ({ relation }: { relation: GraphRelation }) =>
        relation.id !== toFilterBy.nodeId &&
        relation.to.id !== toFilterBy.nodeId &&
        relation.from.id !== toFilterBy.nodeId,
    );
  }

  const nodeScores = new Map<string, number>();
  results.nodes.forEach(({ node, score }) => nodeScores.set(node.id, score));

  const matches = [
    ...results.nodes.map(({ node, score }: NodeResult) => ({
      key: node.id,
      type: "node" as const,
      object: node,
      score,
    })),
    ...results.relations.map(({ relation, score }: RelationResult) => ({
      key: relation.id,
      type: "relation" as const,
      object: relation,
      score: Math.min(nodeScores.get(relation.from.id) || score, score),
    })),
    ...results.relationTypes.flatMap(({ relationType, score }: RelationTypeResult) => {
      if (relationType.id === toFilterBy.relationTypeId) {
        return [];
      }

      const res = [];
      const label = relationType.label.toLocaleLowerCase();
      const reverseLabel = relationType.reverseLabel.toLocaleLowerCase();
      if (label.includes(text)) {
        res.push({
          key: relationType.id,
          type: "relationType" as const,
          object: relationType,
          score,
          isForward: true,
        });
      }
      if (label !== reverseLabel && reverseLabel.includes(text)) {
        res.push({
          key: relationType.id + "-rev",
          type: "relationType" as const,
          object: relationType,
          score,
          isForward: false,
        });
      }
      return res;
    }),
  ];

  return matches
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      // node before relation before relationType
      if (a.type === "node" && b.type !== "node") return -1;
      if (b.type === "node" && a.type !== "node") return 1;
      if (a.type === "relation" && b.type === "relationType") return -1;
      if (b.type === "relation" && a.type === "relationType") return 1;
      // forward relationType should come before reverse relationType
      if (a.type === "relationType" && b.type === "relationType") {
        return a.isForward ? -1 : 1;
      }
      // relationType don't have createdAt
      if (a.type === "relationType" || b.type === "relationType") return a.key.localeCompare(b.key);

      const timeDiff = b.object.createdAt.getTime() - a.object.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;

      return a.key.localeCompare(b.key);
    })
    .slice(0, maxResults);
}

export const useGetMatches = (maxResults: number, toFilterBy: FilterBy = {}): GetMatches => {
  const graphStore = useGraphStore();

  return useCallback(
    (text: string, types?: NodeType[]) => getMatches(graphStore, text, types, toFilterBy, maxResults),
    [graphStore, maxResults, toFilterBy],
  );
};

export const useGetRecentNodes = (maxResults: number, toFilterByNodeId?: string): (() => Match[]) => {
  const graphStore = useGraphStore();

  return useCallback((): Match[] => {
    let recentNodes = Array.from(graphStore.nodesById.values());

    if (toFilterByNodeId) {
      recentNodes = recentNodes.filter((node) => toFilterByNodeId !== node.id);
    }

    return recentNodes
      .filter((node) => node.text.length > 0)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, maxResults)
      .map((node) => ({ key: node.id, type: "node" as const, object: node, score: 0 }));
  }, [graphStore, maxResults, toFilterByNodeId]);
};
