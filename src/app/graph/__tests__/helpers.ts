import { GraphRelation } from "@/app/graph/GraphRelation";

// Store always initializes with at least 3 nodes: userRoot, outlineRoot, and thoughtstreamRoot
export const MIN_NUM_NODES = 3;

// Store always initializes with at least 2 relations: userRoot -> outlineRoot and userRoot -> thoughtstreamRoot
export const MIN_NUM_RELATIONS = 2;

export const getRelationPosition = (relation: GraphRelation, forward: boolean): number => {
  if (forward) {
    return relation.from.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  } else {
    return relation.to.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  }
};
