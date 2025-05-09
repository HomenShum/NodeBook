import { useCallback } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphNodeMatch, GraphRelationTypeMatch, Match } from "@/app/editor/plugins/dropdown/types";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { GraphRelationType } from "@/app/graph/types";
import { DescendantTreeNode, TreeNode } from "@/app/tree/nodes";
import { isNoteContent } from "@/app/tree/utils";
import { scoreMatch } from "@/lib/utils";

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

function countRelationTypeRelations(graphStore: GraphStore, relationTypeIds: string[]) {
  const relationTypesSizes = new Map<string, number>();
  for (const relation of graphStore.getRelations()) {
    if (relationTypeIds.includes(relation.relationType.id)) {
      const currentSize = relationTypesSizes.get(relation.relationType.id) || 0;
      relationTypesSizes.set(relation.relationType.id, currentSize + 1);
    }
  }

  return relationTypesSizes;
}

function processRelationTypes(graphStore: GraphStore, relationTypes: RelationTypeResult[], text: string) {
  const relationTypesSizes = countRelationTypeRelations(
    graphStore,
    relationTypes.map(({ relationType }) => relationType.id),
  );

  const filteredRelationTypes = new Map<string, GraphRelationTypeMatch[]>();
  relationTypes.forEach(({ relationType, score }: RelationTypeResult) => {
    const label = relationType.label.toLocaleLowerCase();
    const reverseLabel = relationType.reverseLabel.toLocaleLowerCase();

    const res: GraphRelationTypeMatch[] = [];
    if (label.includes(text)) {
      res.push({
        key: relationType.id + "-rel-type",
        type: "relationType" as const,
        object: relationType,
        score,
        isForward: true,
      });
    }
    if (label !== reverseLabel && reverseLabel.includes(text)) {
      res.push({
        key: relationType.id + "-rel-type-rev",
        type: "relationType" as const,
        object: relationType,
        score,
        isForward: false,
      });
    }

    if (res.length === 0) {
      return;
    }

    // If the relation type belongs to the user, we don't need to check if it has more relations
    if (relationType.authorId === graphStore.user.id) {
      filteredRelationTypes.set(label, res);
      return;
    }

    const storedRelationType = filteredRelationTypes.get(label);
    if (storedRelationType) {
      const storedRelationTypeBelongsToUser = storedRelationType[0].object.authorId === graphStore.user.id;
      const storedRelationTypeHasMoreRelations =
        (relationTypesSizes.get(storedRelationType[0].object.id) ?? 0) > (relationTypesSizes.get(relationType.id) ?? 0);

      if (storedRelationTypeBelongsToUser || storedRelationTypeHasMoreRelations) {
        return;
      }
    }

    filteredRelationTypes.set(label, res);
  });

  return [...filteredRelationTypes.values()].flat();
}

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
    ...processRelationTypes(graphStore, results.relationTypes, text),
  ];

  return matches
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      // relationType before node before relation
      if (a.type === "relationType" && b.type !== "relationType") return -1;
      if (b.type === "relationType" && a.type !== "relationType") return 1;
      if (a.type === "node" && b.type === "relation") return -1;
      if (b.type === "node" && a.type === "relation") return 1;
      // forward relationType should come before reverse relationType
      if (a.type === "relationType" && b.type === "relationType") {
        return a.isForward ? -1 : 1;
      }

      if (a.type === "node" && b.type === "node") {
        // Prefer non-notes over notes
        const aIsNote = a.object.noteContentRelationsList.size > 0;
        const bIsNote = b.object.noteContentRelationsList.size > 0;
        if (aIsNote && !bIsNote) return 1;
        if (!aIsNote && bIsNote) return -1;
        // Prefer the node with more relations
        const aRelations = a.object.relations.length;
        const bRelations = b.object.relations.length;
        if (aRelations !== bRelations) return bRelations - aRelations;
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
      const isNote = isNoteContent(treeNode);
      return matches.filter((match) => {
        if (match.type === "node") {
          // If it's a note, we must ensure that this match isn't a reference to the note's root node
          if (match.object.id === treeNode.object.id) {
            return false; // don't do reflexive relations
          } else if (isNote && treeNode instanceof DescendantTreeNode) {
            // Don't allow the note to reference its parent if the parent is a note
            return match.object.id !== treeNode.parentGroup.parent.object.id;
          } else {
            return true;
          }
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

export const useGetRecentNodes = (maxResults: number, toFilterByNodeId?: string): (() => GraphNodeMatch[]) => {
  const graphStore = useGraphStore();

  return useCallback((): GraphNodeMatch[] => {
    let recentNodes = Array.from(graphStore.nodesById.values());

    if (toFilterByNodeId) {
      recentNodes = recentNodes.filter((node) => toFilterByNodeId !== node.id);
    }

    const results = recentNodes
      .filter((node) => node.text.length > 0)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, maxResults)
      .map((node) => ({ key: node.id, type: "node" as const, object: node, score: 0 }));

    graphStore.layerManager.lazyLoadWithIds(results.map((node) => node.object.id));

    return results;
  }, [graphStore, maxResults, toFilterByNodeId]);
};

export const useGetMatchesForHashtags = (maxResults: number): GetMatches => {
  const graphStore = useGraphStore();

  return useCallback(
    (text: string) => {
      const results = graphStore.myHashtagsNode.children
        .filter((node) => node instanceof GraphNode)
        .filter((node) => node.text.toLocaleLowerCase().includes(text.toLocaleLowerCase()))
        .sort((a, b) => scoreMatch(b.text, text) - scoreMatch(a.text, text))
        .slice(0, maxResults)
        .map((node) => ({ key: node.id, type: "node" as const, object: node as GraphNode, score: 0 }));

      return results;
    },
    [graphStore.myHashtagsNode.children, maxResults],
  );
};

export const useGetRecentHashtags = (maxResults: number, toFilterByNodeId?: string): (() => GraphNodeMatch[]) => {
  const graphStore = useGraphStore();

  return useCallback(() => {
    const results = graphStore.myHashtagsNode.children
      .filter((node) => node.id !== toFilterByNodeId && node instanceof GraphNode)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, maxResults)
      .map((node) => ({ key: node.id, type: "node" as const, object: node as GraphNode, score: 0 }));

    graphStore.layerManager.lazyLoadWithIds(results.map((node) => node.object.id));

    return results;
  }, [graphStore, maxResults, toFilterByNodeId]);
};

export const useGetMatchesForTemplate = (maxResults: number): ((text: string) => GraphNodeMatch[]) => {
  const graphStore = useGraphStore();

  return useCallback(
    (text: string) => {
      const results = graphStore.myTemplatesNode.children
        .filter((node) => node instanceof GraphNode)
        .filter((node) => node.text.toLocaleLowerCase().includes(text.toLocaleLowerCase()))
        .sort((a, b) => scoreMatch(b.text, text) - scoreMatch(a.text, text))
        .slice(0, maxResults)
        .map((node) => ({ key: node.id, type: "node" as const, object: node as GraphNode, score: 0 }));

      return results;
    },
    [graphStore.myTemplatesNode.children, maxResults],
  );
};

export const useGetRecentTemplates = (maxResults: number): (() => GraphNodeMatch[]) => {
  const graphStore = useGraphStore();

  return useCallback(() => {
    const results = graphStore.myTemplatesNode.children
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, maxResults)
      .map((node) => ({ key: node.id, type: "node" as const, object: node as GraphNode, score: 0 }));

    graphStore.layerManager.lazyLoadWithIds(results.map((node) => node.object.id));

    return results;
  }, [graphStore, maxResults]);
};
