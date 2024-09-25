import { and, eq } from "drizzle-orm";

import { SerializedRelation } from "@/app/persistence/SerializedData";
import { graphRelationTable, relationListsTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";
import { GLOBAL_TO_USER_RELATION_ID_PREFIX } from "@/lib/constants";

export const createRelations = async (tx: MewDbTransaction, relations: SerializedRelation[]) => {
  const newRelations = await tx
    .insert(graphRelationTable)
    .values(
      relations.map((relation) => ({
        authorId: relation.authorId,
        id: relation.id,
        version: relation.version,
        fromId: relation.fromId,
        toId: relation.toId,
        relationTypeId: relation.relationTypeId,
        isPublic: relation.isPublic,
      })),
    )
    .returning({ createdId: graphRelationTable.id });
  if (newRelations.length !== relations.length) {
    console.error(`[sync][createRelations] Unable to create all relations`);
    tx.rollback();
  }
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
      createdAt: newProps.createdAt,
      version: newProps.version,
      fromId: newProps.fromId,
      toId: newProps.toId,
      relationTypeId: newProps.relationTypeId,
      isPublic: newProps.isPublic,
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
      `[sync][updateRelation] Relation with authorId ${oldProps.authorId}, id ${oldProps.id}, and version ${oldProps.version} not found`,
    );
    tx.rollback();
  }
  if (!oldProps.isPublic && newProps.isPublic) {
    // When making a relation public, update all relationLists entries that reference this relation to be public.
    // We don't have to worry about updating when making a relation private, because the position just won't get
    // serialized into the snapshot without the relation.
    // TODO: Figure out if this is a sign that we should be doing something differently
    await tx
      .update(relationListsTable)
      .set({ isPublic: true })
      .where(and(eq(relationListsTable.authorId, newProps.authorId), eq(relationListsTable.relationId, newProps.id)));
  }
};

export const deleteRelation = async (tx: MewDbTransaction, relation: SerializedRelation) => {
  if (relation.id.startsWith(GLOBAL_TO_USER_RELATION_ID_PREFIX)) {
    throw new Error("Cannot delete relation from global to user");
  }

  // Delete all relationLists entries that reference this relation
  await tx.delete(relationListsTable).where(eq(relationListsTable.relationId, relation.id));

  // Delete relation from main table
  const deletedRelation = await tx
    .delete(graphRelationTable)
    .where(
      and(
        eq(graphRelationTable.authorId, relation.authorId),
        eq(graphRelationTable.id, relation.id),
        eq(graphRelationTable.version, relation.version),
      ),
    )
    .returning({ deletedId: graphRelationTable.id });

  // If there was no row for the relation in the main table, log an error and rollback the transaction
  if (deletedRelation.length === 0) {
    console.error(
      `[sync][deleteRelation] Relation with authorId ${relation.authorId}, id ${relation.id} and version ${relation.version} not found`,
    );
    tx.rollback();
  }
};
