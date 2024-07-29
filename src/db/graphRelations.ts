import { and, eq } from "drizzle-orm";

import { SerializedRelation } from "@/app/persistence/SerializedData";
import { graphRelationTable, relationListsTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";

export const createRelation = async (tx: MewDbTransaction, relation: SerializedRelation) => {
  await tx.insert(graphRelationTable).values({
    authorId: relation.authorId,
    id: relation.id,
    version: relation.version,
    fromId: relation.fromId,
    toId: relation.toId,
    relationTypeId: relation.relationTypeId,
    isPrivate: relation.isPrivate,
  });
};

export const updateRelation = async (
  tx: MewDbTransaction,
  oldProps: SerializedRelation,
  newProps: SerializedRelation,
) => {
  const updated = await tx
    .update(graphRelationTable)
    .set({
      authorId: newProps.authorId,
      id: newProps.id,
      version: newProps.version,
      fromId: newProps.fromId,
      toId: newProps.toId,
      relationTypeId: newProps.relationTypeId,
      isPrivate: newProps.isPrivate,
    })
    .where(
      and(
        eq(graphRelationTable.authorId, oldProps.authorId),
        eq(graphRelationTable.id, oldProps.id),
        eq(graphRelationTable.version, oldProps.version),
      ),
    )
    .returning({ updatedId: graphRelationTable.id });
  if (updated.length === 0) {
    console.error(
      `Relation with authorId ${oldProps.authorId}, id ${oldProps.id}, and version ${oldProps.version} not found`,
    );
    tx.rollback();
  }
};

export const deleteRelation = async (tx: MewDbTransaction, relation: SerializedRelation) => {
  // Delete all relationLists entries that reference this relation
  await tx.delete(relationListsTable).where(eq(relationListsTable.relationId, relation.id));

  // Delete relation from main table
  const deletedRelation = await tx
    .delete(graphRelationTable)
    .where(and(eq(graphRelationTable.id, relation.id), eq(graphRelationTable.version, relation.version)))
    .returning({ deletedId: graphRelationTable.id });

  // If there was no row for the relation in the main table, log an error and rollback the transaction
  if (deletedRelation.length === 0) {
    console.error(`Relation with id ${relation.id} not found`);
    tx.rollback();
  }
};
