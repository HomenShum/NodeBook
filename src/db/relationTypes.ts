import { and, eq } from "drizzle-orm";

import { GraphRelationType } from "@/app/graph/GraphRelation";
import { relationTypeTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";

export const createRelationType = async (tx: MewDbTransaction, relType: GraphRelationType) => {
  await tx.insert(relationTypeTable).values({
    authorId: relType.authorId,
    id: relType.id,
    version: relType.version,
    label: relType.label,
    reverseLabel: relType.reverseLabel,
  });
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
      `Relation type with authorId ${oldProps.authorId}, id ${oldProps.id}, and version ${oldProps.version} not found`,
    );
    tx.rollback();
  }
};

export const deleteRelationType = async (tx: MewDbTransaction, relType: GraphRelationType) => {
  await tx
    .delete(relationTypeTable)
    .where(and(eq(relationTypeTable.id, relType.id), eq(relationTypeTable.version, relType.version)));
};
