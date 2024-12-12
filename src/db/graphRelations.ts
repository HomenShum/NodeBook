import { and, eq } from "drizzle-orm";

import { SerializedRelation } from "@/app/persistence/SerializedData";
import { graphRelationTable, relationListsTable } from "@/db/schema";
import { SyncError } from "@/db/SyncError";
import { MewDbTransaction } from "@/db/types";
import { USERS_TO_USER_RELATION_ID_PREFIX } from "@/lib/constants";

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
        canonicalRelationId: relation.canonicalRelationId,
      })),
    )
    .returning({ createdId: graphRelationTable.id });
  if (newRelations.length !== relations.length) {
    throw new SyncError("Unable to create all relations", { actionName: "createRelations", data: { relations } });
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
      canonicalRelationId: newProps.canonicalRelationId,
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
    throw new SyncError("Relation to update not found", { actionName: "updateRelation", data: { oldProps, newProps } });
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
  if (relation.id.startsWith(USERS_TO_USER_RELATION_ID_PREFIX)) {
    throw new SyncError("Cannot delete relation from global to user", {
      actionName: "deleteRelation",
      data: { relation },
    });
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
    throw new SyncError("Relation to delete not found", { actionName: "deleteRelation", data: { relation } });
  }
};
