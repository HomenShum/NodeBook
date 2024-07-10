import { eq } from "drizzle-orm";

import { SerializedRelation } from "@/app/persistence/SerializedData";
import { graphRelationTable, relationListsTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";

export const upsertRelation = async (tx: MewDbTransaction, relation: SerializedRelation) => {
  const existing = await tx.select().from(graphRelationTable).where(eq(graphRelationTable.id, relation.id));
  if (existing.length === 0) {
    // TODO: Decide if we want to enforce that incoming relation version === 1 here
  } else if (existing.length === 1) {
    const existingRelation = existing[0];
    if (relation.version !== existingRelation.version + 1) {
      console.error(`Version mismatch for relation ${relation.id}`);
      tx.rollback();
    }
  } else {
    // Should never happen because id is a primary key
    console.error(`Multiple relations with id ${relation.id} found`);
    tx.rollback();
  }
  await tx
    .insert(graphRelationTable)
    .values({
      id: relation.id,
      version: relation.version,
      fromId: relation.fromId,
      toId: relation.toId,
      relationTypeId: relation.relationTypeId,
      isPrivate: relation.isPrivate,
    })
    .onConflictDoUpdate({
      target: [graphRelationTable.id],
      set: {
        version: relation.version,
        fromId: relation.fromId,
        toId: relation.toId,
        relationTypeId: relation.relationTypeId,
        isPrivate: relation.isPrivate,
      },
    });
};

export const deleteRelation = async (tx: MewDbTransaction, relation: SerializedRelation) => {
  // Delete all relationLists entries that reference this relation
  await tx.delete(relationListsTable).where(eq(relationListsTable.relationId, relation.id));

  // Delete relation from main table
  // TODO: Check version here also?
  const deletedRelation = await tx
    .delete(graphRelationTable)
    .where(eq(graphRelationTable.id, relation.id))
    .returning({ deletedId: graphRelationTable.id });

  // If there was no row for the relation in the main table, log an error and rollback the transaction
  if (deletedRelation.length === 0) {
    console.error(`Relation with id ${relation.id} not found`);
    tx.rollback();
  }
};
