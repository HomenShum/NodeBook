import { and, eq } from "drizzle-orm";

import { GraphRelation } from "@/app/graph/GraphRelation";
import { SerializedPositionList } from "@/app/persistence/SerializedData";
import { relationListsTable } from "@/db/schema";
import { MewDbTransaction } from "@/db/types";

export const upsertRelationList = async (
  tx: MewDbTransaction,
  nodeId: string,
  relationList: SerializedPositionList<GraphRelation>,
  pinned: boolean,
) => {
  await tx
    .delete(relationListsTable)
    .where(and(eq(relationListsTable.nodeId, nodeId), eq(relationListsTable.pinned, pinned)));
  for (const [relationId, position] of Object.entries(relationList)) {
    await tx
      .insert(relationListsTable)
      .values({
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
