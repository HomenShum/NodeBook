import { and, eq } from "drizzle-orm";

import { GraphRelationType } from "@/app/graph/types";
import { relationTypeTable } from "@/db/schema";
import { SyncError } from "@/db/SyncError";
import { MewDbTransaction } from "@/db/types";

export const createRelationTypes = async (tx: MewDbTransaction, relTypes: GraphRelationType[]) => {
  const newRelTypes = await tx
    .insert(relationTypeTable)
    .values(
      relTypes.map((relType) => ({
        authorId: relType.authorId,
        id: relType.id,
        version: relType.version,
        label: relType.label,
        reverseLabel: relType.reverseLabel,
        isPublic: relType.isPublic,
      })),
    )
    .returning({ createdId: relationTypeTable.id });

  if (newRelTypes.length !== relTypes.length) {
    throw new SyncError("Unable to create all relation types", {
      actionName: "createRelationTypes",
      data: { relTypes },
    });
  }
};

export const updateRelationType = async (
  tx: MewDbTransaction,
  oldProps: GraphRelationType,
  newProps: GraphRelationType,
) => {
  const updated = await tx
    .update(relationTypeTable)
    .set({
      authorId: newProps.authorId,
      id: newProps.id,
      version: newProps.version,
      label: newProps.label,
      reverseLabel: newProps.reverseLabel,
      isPublic: newProps.isPublic,
    })
    .where(
      and(
        eq(relationTypeTable.authorId, oldProps.authorId),
        eq(relationTypeTable.id, oldProps.id),
        eq(relationTypeTable.version, oldProps.version),
      ),
    )
    .returning({ updatedId: relationTypeTable.id });
  if (updated.length === 0) {
    throw new SyncError("Relation type to update not found", {
      actionName: "updateRelationType",
      data: { oldProps, newProps },
    });
  }
};

export const deleteRelationType = async (tx: MewDbTransaction, relType: GraphRelationType) => {
  const deletedRelationType = await tx
    .delete(relationTypeTable)
    .where(
      and(
        eq(relationTypeTable.authorId, relType.authorId),
        eq(relationTypeTable.id, relType.id),
        eq(relationTypeTable.version, relType.version),
      ),
    )
    .returning({ deletedId: relationTypeTable.id });

  // If there was no row for the relation type in the table, log an error and rollback the transaction
  if (deletedRelationType.length === 0) {
    throw new SyncError("Relation type to delete not found", {
      actionName: "deleteRelationType",
      data: { relType },
    });
  }
};
