import { and, eq } from "drizzle-orm";

import { SerializedNode } from "@/app/persistence/SerializedData";
import { graphNodeTable, relationListsTable } from "@/db/schema";
import { SyncError } from "@/db/SyncError";
import { MewDbTransaction } from "@/db/types";
import {
  GLOBAL_ROOT_ID,
  USER_MY_FAVORITES_NODE_ID_PREFIX,
  USER_MY_HASHTAGS_NODE_ID_PREFIX,
  USER_MY_STREAM_NODE_ID_PREFIX,
  USER_ROOT_ID_PREFIX,
} from "@/lib/constants";

export const createNodes = async (tx: MewDbTransaction, nodes: SerializedNode[]) => {
  const newNodes = await tx
    .insert(graphNodeTable)
    .values(
      nodes.map((node) => ({
        authorId: node.authorId,
        id: node.id,
        version: node.version,
        createdAt: new Date(node.createdAt),
        updatedAt: new Date(node.updatedAt),
        content: JSON.stringify(node.content),
        isPublic: node.isPublic,
        isNewRelatedObjectsPublic: node.isNewRelatedObjectsPublic,
        isChecked: node.isChecked ?? null,
        canonicalRelationId: node.canonicalRelationId,
      })),
    )
    .returning({ createdId: graphNodeTable.id });
  if (newNodes.length !== nodes.length) {
    throw new SyncError("Unable to create all nodes", { actionName: "createNodes", data: { nodes } });
  }
};

const contentNotEqual = (a: SerializedNode, b: SerializedNode) =>
  JSON.stringify(a.content) !== JSON.stringify(b.content);

export const updateNode = async (tx: MewDbTransaction, oldProps: SerializedNode, newProps: SerializedNode) => {
  if (newProps.id === GLOBAL_ROOT_ID) {
    throw new SyncError("Cannot update global root node", { actionName: "updateNode", data: { oldProps, newProps } });
  }
  if (oldProps.id.startsWith(USER_MY_HASHTAGS_NODE_ID_PREFIX) && contentNotEqual(oldProps, newProps)) {
    throw new SyncError('Cannot update content of user\'s "My Hashtags" node', {
      actionName: "updateNode",
      data: { oldProps, newProps },
    });
  }
  if (oldProps.id.startsWith(USER_MY_FAVORITES_NODE_ID_PREFIX) && contentNotEqual(oldProps, newProps)) {
    throw new SyncError('Cannot update content of user\'s "My Favorites" node', {
      actionName: "updateNode",
      data: { oldProps, newProps },
    });
  }
  if (oldProps.id.startsWith(USER_MY_STREAM_NODE_ID_PREFIX) && contentNotEqual(oldProps, newProps)) {
    throw new SyncError('Cannot update content of user\'s "My Stream" node', {
      actionName: "updateNode",
      data: { oldProps, newProps },
    });
  }
  const updated = await tx
    .update(graphNodeTable)
    .set({
      authorId: newProps.authorId,
      id: newProps.id,
      version: newProps.version,
      createdAt: new Date(newProps.createdAt),
      updatedAt: new Date(newProps.updatedAt),
      content: JSON.stringify(newProps.content),
      isPublic: newProps.isPublic,
      isNewRelatedObjectsPublic: newProps.isNewRelatedObjectsPublic,
      isChecked: newProps.isChecked ?? null,
      canonicalRelationId: newProps.canonicalRelationId,
    })
    .where(and(eq(graphNodeTable.authorId, oldProps.authorId), eq(graphNodeTable.id, oldProps.id)))
    .returning({ updatedId: graphNodeTable.id });
  if (updated.length === 0) {
    throw new SyncError("Node to update not found", { actionName: "updateNode", data: { oldProps, newProps } });
  }
};

export const deleteNode = async (tx: MewDbTransaction, node: SerializedNode) => {
  if (node.id === GLOBAL_ROOT_ID) {
    throw new SyncError("Cannot delete global root node", { actionName: "deleteNode", data: { node } });
  }
  if (node.id.startsWith(USER_ROOT_ID_PREFIX)) {
    throw new SyncError("Cannot delete user root node", { actionName: "deleteNode", data: { node } });
  }
  if (node.id.startsWith(USER_MY_HASHTAGS_NODE_ID_PREFIX)) {
    throw new SyncError('Cannot delete user\'s "My Hashtags" node', { actionName: "deleteNode", data: { node } });
  }

  // Delete all relationLists entries that reference this node
  await tx.delete(relationListsTable).where(eq(relationListsTable.nodeId, node.id));

  // Delete node from main table
  const deletedNode = await tx
    .delete(graphNodeTable)
    .where(
      and(
        eq(graphNodeTable.authorId, node.authorId),
        eq(graphNodeTable.id, node.id),
        eq(graphNodeTable.version, node.version),
      ),
    )
    .returning({ deletedId: graphNodeTable.id });

  // If there was no row for the node in the main table, return false instead of throwing
  if (deletedNode.length === 0) {
    return false;
  }

  return true;
};
