import { useCallback } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { Match } from "@/app/editor/plugins/dropdown/types";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphRelationType } from "@/app/graph/types";
import { TreeNode } from "@/app/tree/nodes";

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
  maxResults: number,
): Match[] {
  text = text.toLocaleLowerCase().trim();
  const results = graphStore.search({ text, filters: { types } });

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
    ...results.relationTypes
      .map(({ relationType, score }: RelationTypeResult) => {
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
      })
      .flat(),
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

export const useGetMatchesForCommandBar = (maxResults: number): GetMatches => {
  const graphStore = useGraphStore();

  return useCallback(
    (text: string, types?: NodeType[]) => getMatches(graphStore, text, types, maxResults),
    [graphStore, maxResults],
  );
};

export const useGetMatchesForTreeNode = (maxResults: number, treeNode: TreeNode): GetMatches => {
  const graphStore = useGraphStore();

  return useCallback(
    (text: string, types?: NodeType[]) => {
      const matches = getMatches(graphStore, text, types, maxResults);
      return matches.filter((match) => {
        if (match.type === "node") {
          return match.object.id !== treeNode.object.id;
        }
        if (match.type === "relation") {
          return (
            match.object.id !== treeNode.object.id &&
            match.object.to.id !== treeNode.object.id &&
            match.object.from.id !== treeNode.object.id
          );
        }
        if (match.type === "relationType") {
          // Not the same relation type and direction
          return !(
            match.object.id === treeNode.relationWithParent?.relationType.id &&
            match.isForward === !treeNode.isBackrelation
          );
        }
        return true;
      });
    },
    [graphStore, maxResults, treeNode],
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
