import { GraphRelation } from "@/app/graph/GraphRelation";

// Store always initializes with user node
export const MIN_NUM_NODES = 1;

export const MIN_NUM_RELATIONS = 0;

export const getRelationPosition = (relation: GraphRelation, forward: boolean): number => {
  if (forward) {
    return relation.from.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  } else {
    return relation.to.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  }
};
