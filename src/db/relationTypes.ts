import { and, eq } from "drizzle-orm";

import { GraphRelationType } from "@/app/graph/GraphRelation";
import { relationTypeTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";

export const createRelationType = async (tx: MewDbTransaction, relType: GraphRelationType) => {
  await tx.insert(relationTypeTable).values({
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
  await tx
    .update(relationTypeTable)
    .set({
      id: newProps.id,
      version: newProps.version,
      label: newProps.label,
      reverseLabel: newProps.reverseLabel,
    })
    .where(and(eq(relationTypeTable.id, oldProps.id), eq(relationTypeTable.version, oldProps.version)));
};

export const deleteRelationType = async (tx: MewDbTransaction, relType: GraphRelationType) => {
  await tx
    .delete(relationTypeTable)
    .where(and(eq(relationTypeTable.id, relType.id), eq(relationTypeTable.version, relType.version)));
};
