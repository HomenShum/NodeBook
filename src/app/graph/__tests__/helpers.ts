import { GraphRelation } from "@/app/graph/GraphRelation";
import { GLOBAL_ROOT_ID, GLOBAL_USERS_NODE_ID } from "@/lib/constants";

/**
 * The number of nodes that should exist when the store is initialized
 */
// global, users, user, my hashtags, my favorites, my templates, __user_relation_types__, __global_relation_types__, my stream, __card_statuses__, global_hashtags + 4 default statuses
export const MIN_NUM_NODES = 15;

/**
 * The number of nodes that should be created when the store is initialized.
 * This doesn't include the global root or users nodes. We instantiate those but
 * we don't create a new one. There's only one and it's already on the server.
 */
export const MIN_NUM_CREATED_NODES = 12;

// Includes: global-to-users, users-to-user, user-to-hashtags, global-types-to-user-types, global-to-global-types,
// global-root-to-hashtags, global-hashtags-to-user-hashtags + default relations
export const MIN_NUM_RELATIONS = 16;
/**
 * The number of relations that should be created when the store is initialized.
 * This doesn't include the relation b/w
 * {@link GLOBAL_USERS_NODE_ID | users node} and
 * {@link GLOBAL_ROOT_ID | global root}. We instantiate those but we don't
 * create a new one. There's only one and it's already on the server.
 */
export const MIN_NUM_CREATED_RELATIONS = 14;

export const getRelationPosition = (relation: GraphRelation, forward: boolean): number => {
  if (forward) {
    return relation.from.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  } else {
    return relation.to.relationsSortedByPosition.findIndex((r) => r.id === relation.id);
  }
};
