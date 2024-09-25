import { and, eq } from "drizzle-orm";

import { GraphRelationType } from "@/app/graph/types";
import { relationTypeTable } from "@/db/schema";
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
    console.error(`[sync][createRelationTypes] Unable to create all relation types`);
    tx.rollback();
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
    console.error(
      `[sync][updateRelationType] Relation type with authorId ${oldProps.authorId}, id ${oldProps.id}, and version ${oldProps.version} not found`,
    );
    tx.rollback();
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
    console.error(
      `[sync][deleteRelationType] RelationType with authorId ${relType.authorId}, id ${relType.id} and version ${relType.version} not found`,
    );
    tx.rollback();
  }
};
