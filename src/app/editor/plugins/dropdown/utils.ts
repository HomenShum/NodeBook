import { useCallback } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { Match } from "@/app/editor/plugins/dropdown/types";

export type NodeType = "node" | "relation" | "relationType";

interface FilterBy {
  nodeId?: string;
  relationTypeId?: string;
}

type GetMatches = (text: string, types?: NodeType[]) => Match[];

export const useGetMatches = (maxResults: number, toFilterBy: FilterBy = {}): GetMatches => {
  const graphStore = useGraphStore();

  return useCallback(
    (text: string, types?: NodeType[]) => {
      text = text.toLocaleLowerCase().trim();
      let results = graphStore.search({ text, filters: { types }, sort: { by: "score" } });

      if (toFilterBy.nodeId) {
        results.nodes = results.nodes.filter(({ node }) => node.id !== toFilterBy.nodeId);
        results.relations = results.relations.filter(
          ({ relation }) =>
            relation.id !== toFilterBy.nodeId &&
            relation.to.id !== toFilterBy.nodeId &&
            relation.from.id !== toFilterBy.nodeId,
        );
      }

      const matches = [
        ...results.nodes.map(({ node, score }) => ({ key: node.id, type: "node" as const, object: node, score })),

        ...results.relations.map(({ relation, score }) => ({
          key: relation.id,
          type: "relation" as const,
          object: relation,
          score,
        })),

        ...results.relationTypes.flatMap(({ relationType, score }) => {
          if (relationType.id === toFilterBy.relationTypeId) {
            return [];
          }

          const res: Match[] = [];
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
          if (a.type === "relationType" || b.type === "relationType") return -1;
          // then by creation date
          return b.object.createdAt.getTime() - a.object.createdAt.getTime();
        })
        .slice(0, maxResults);
    },
    [graphStore, maxResults, toFilterBy.nodeId, toFilterBy.relationTypeId],
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
