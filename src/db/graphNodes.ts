import { eq } from "drizzle-orm";

import { SerializedGraphNode } from "@/app/persistence/SerializedData";
import { graphNodeTable, relationListsTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";

export const upsertNode = async (tx: MewDbTransaction, node: SerializedGraphNode) => {
  const existing = await tx.select().from(graphNodeTable).where(eq(graphNodeTable.id, node.id));
  if (existing.length === 0) {
    // TODO: Decide if we want to enforce that incoming node version === 1 here
  } else if (existing.length === 1) {
    const existingNode = existing[0];
    if (node.version !== existingNode.version + 1) {
      console.error(`Node version mismatch for node ${node.id}`);
      tx.rollback();
    }
  } else {
    // Should never happen because id is a primary key
    console.error(`Multiple nodes with id ${node.id} found`);
    tx.rollback();
  }
  await tx
    .insert(graphNodeTable)
    .values({
      id: node.id,
      version: node.version,
      createdAt: new Date(node.createdAt),
      content: JSON.stringify(node.content),
      isBundle: node.isBundle,
      isZone: node.isZone,
      isPrivate: node.isPrivate,
    })
    .onConflictDoUpdate({
      target: [graphNodeTable.id],
      set: {
        version: node.version,
        createdAt: new Date(node.createdAt),
        content: JSON.stringify(node.content),
        isBundle: node.isBundle,
        isZone: node.isZone,
        isPrivate: node.isPrivate,
      },
    });
};

export const deleteNode = async (tx: MewDbTransaction, node: SerializedGraphNode) => {
  // Delete all relationLists entries that reference this node
  await tx.delete(relationListsTable).where(eq(relationListsTable.nodeId, node.id));

  // Delete node from main table
  // TODO: Check version here also?
  const deletedNode = await tx
    .delete(graphNodeTable)
    .where(eq(graphNodeTable.id, node.id))
    .returning({ deletedId: graphNodeTable.id });

  // If there was no row for the node in the main table, log an error and rollback the transaction
  if (deletedNode.length === 0) {
    console.error(`Node with id ${node.id} not found`);
    tx.rollback();
  }
};
