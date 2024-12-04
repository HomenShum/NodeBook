import { GraphRelation } from "@/app/graph/GraphRelation";
import { GLOBAL_ROOT_ID, GLOBAL_USERS_NODE_ID } from "@/lib/constants";

/**
 * The number of nodes that should exist when the store is initialized with a non-anonymous user.
 */
export const MIN_NUM_NODES_WITH_USER = 4; // global, users, user, my hashtags

/**
 * The number of nodes that should exist when the store is initialized with an anonymous user.
 *
 * The big thing here is that we don't create a user root, and instead use the global root.
 */
export const MIN_NUM_NODES_WITH_ANONYMOUS_USER = 2; // global, users

/**
 * The number of nodes that should be created when the store is initialized.
 * This doesn't include the global root or users nodes. We instantiate those but
 * we don't create a new one. There's only one and it's already on the server.
 */
export const MIN_NUM_CREATED_NODES = 2;

export const MIN_NUM_RELATIONS = 3;
/**
 * The number of relations that should be created when the store is initialized.
 * This doesn't include the relation b/w
 * {@link GLOBAL_USERS_NODE_ID | users node} and
 * {@link GLOBAL_ROOT_ID | global root}. We instantiate those but we don't
 * create a new one. There's only one and it's already on the server.
 */
export const MIN_NUM_CREATED_RELATIONS = 2;

export const getRelationPosition = (relation: GraphRelation, forward: boolean): number => {
  if (forward) {
    return relation.from.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  } else {
    return relation.to.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  }
};
