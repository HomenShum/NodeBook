import { and, eq } from "drizzle-orm";

import { SerializedPosition } from "@/app/persistence/SerializedData";
import { relationListsTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";

export const upsertRelationList = async (
  tx: MewDbTransaction,
  nodeId: string,
  authorId: string,
  pinned: boolean,
  relationId: string,
  position: SerializedPosition | null,
) => {
  if (!position) {
    await tx
      .delete(relationListsTable)
      .where(
        and(
          eq(relationListsTable.nodeId, nodeId),
          eq(relationListsTable.relationId, relationId),
          eq(relationListsTable.pinned, pinned),
        ),
      );
  } else {
    await tx
      .insert(relationListsTable)
      .values({
        authorId: authorId,
        nodeId: nodeId,
        relationId: relationId,
        pinned: pinned,
        positionInt: position.int,
        positionFrac: position.frac,
      })
      .onConflictDoUpdate({
        target: [relationListsTable.nodeId, relationListsTable.relationId, relationListsTable.pinned],
        set: {
          positionInt: position.int,
          positionFrac: position.frac,
        },
      });
  }
};
