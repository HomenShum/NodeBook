import { GraphRelation } from "@/app/graph/GraphRelation";
import { GLOBAL_ROOT_ID, GLOBAL_USERS_NODE_ID } from "@/lib/constants";

/**
 * The number of nodes that should exist when the store is initialized.
 */
export const MIN_NUM_NODES = 3; // global, users, user
/**
 * The number of nodes that should be created when the store is initialized.
 * This doesn't include the global root or users nodes. We instantiate those but
 * we don't create a new one. There's only one and it's already on the server.
 */
export const MIN_NUM_CREATED_NODES = 1;

export const MIN_NUM_RELATIONS = 2;
/**
 * The number of relations that should be created when the store is initialized.
 * This doesn't include the relation b/w
 * {@link GLOBAL_USERS_NODE_ID | users node} and
 * {@link GLOBAL_ROOT_ID | global root}. We instantiate those but we don't
 * create a new one. There's only one and it's already on the server.
 */
export const MIN_NUM_CREATED_RELATIONS = 1;

export const getRelationPosition = (relation: GraphRelation, forward: boolean): number => {
  if (forward) {
    return relation.from.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  } else {
    return relation.to.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  }
};
