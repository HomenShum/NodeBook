import { and, eq } from "drizzle-orm";

import { ListType } from "@/app/graph/constants";
import { SerializedPosition } from "@/app/persistence/SerializedData";
import { relationListsTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";

export const upsertRelationList = async (
  tx: MewDbTransaction,
  nodeId: string,
  authorId: string,
  type: ListType,
  relationId: string,
  position: SerializedPosition | null,
  isPublic: boolean,
) => {
  if (!position) {
    await tx
      .delete(relationListsTable)
      .where(
        and(
          eq(relationListsTable.nodeId, nodeId),
          eq(relationListsTable.relationId, relationId),
          eq(relationListsTable.type, type),
        ),
      );
  } else {
    await tx
      .insert(relationListsTable)
      .values({
        authorId: authorId,
        nodeId: nodeId,
        relationId: relationId,
        type: type,
        positionInt: position.int,
        positionFrac: position.frac,
        isPublic: isPublic,
      })
      .onConflictDoUpdate({
        target: [relationListsTable.nodeId, relationListsTable.relationId, relationListsTable.type],
        set: {
          positionInt: position.int,
          positionFrac: position.frac,
          isPublic: isPublic,
        },
      });
  }
};
