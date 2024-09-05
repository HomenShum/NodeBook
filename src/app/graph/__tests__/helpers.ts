import { GraphRelation } from "@/app/graph/GraphRelation";

/**
 * The number of nodes that should exist when the store is initialized.
 */
export const MIN_NUM_NODES = 2; // user + global
/**
 * The number of nodes that should be created when the store is initialized.
 * This doesn't include the global root node. We instantiate a global root node
 * but we don't create a new one. There's only one and it's already on the
 * server.
 */
export const MIN_NUM_CREATED_NODES = 1;

export const MIN_NUM_RELATIONS = 1;

export const getRelationPosition = (relation: GraphRelation, forward: boolean): number => {
  if (forward) {
    return relation.from.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  } else {
    return relation.to.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  }
};
