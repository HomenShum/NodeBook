import { and, eq } from "drizzle-orm";

import { SerializedNode } from "@/app/persistence/SerializedData";
import { graphNodeTable, relationListsTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";
import { GLOBAL_ROOT_ID, USER_ROOT_ID } from "@/lib/constants";

export const createNode = async (tx: MewDbTransaction, node: SerializedNode) => {
  await tx.insert(graphNodeTable).values({
    authorId: node.authorId,
    id: node.id,
    version: node.version,
    createdAt: new Date(node.createdAt),
    content: JSON.stringify(node.content),
    isBundle: node.isBundle,
    isZone: node.isZone,
    isPrivate: node.isPrivate,
  });
};

export const updateNode = async (tx: MewDbTransaction, oldProps: SerializedNode, newProps: SerializedNode) => {
  if (newProps.id === GLOBAL_ROOT_ID) {
    throw new Error("Cannot update global root node");
  }
  const updated = await tx
    .update(graphNodeTable)
    .set({
      authorId: newProps.authorId,
      id: newProps.id,
      version: newProps.version,
      createdAt: new Date(newProps.createdAt),
      content: JSON.stringify(newProps.content),
      isBundle: newProps.isBundle,
      isZone: newProps.isZone,
      isPrivate: newProps.isPrivate,
    })
    .where(
      and(
        eq(graphNodeTable.authorId, oldProps.authorId),
        eq(graphNodeTable.id, oldProps.id),
        eq(graphNodeTable.version, oldProps.version),
      ),
    )
    .returning({ updatedId: graphNodeTable.id });
  if (updated.length === 0) {
    console.error(
      `Node with authorId ${oldProps.authorId}, id ${oldProps.id}, and version ${oldProps.version} not found`,
    );
    tx.rollback();
  }
};

export const deleteNode = async (tx: MewDbTransaction, node: SerializedNode) => {
  if (node.id === USER_ROOT_ID) {
    throw new Error("Cannot delete user root node");
  }
  if (node.id === GLOBAL_ROOT_ID) {
    throw new Error("Cannot delete global root node");
  }

  // Delete all relationLists entries that reference this node
  await tx.delete(relationListsTable).where(eq(relationListsTable.nodeId, node.id));

  // Delete node from main table
  const deletedNode = await tx
    .delete(graphNodeTable)
    .where(and(eq(graphNodeTable.id, node.id), eq(graphNodeTable.version, node.version)))
    .returning({ deletedId: graphNodeTable.id });

  // If there was no row for the node in the main table, log an error and rollback the transaction
  if (deletedNode.length === 0) {
    console.error(`Node with id ${node.id} not found`);
    tx.rollback();
  }
};
