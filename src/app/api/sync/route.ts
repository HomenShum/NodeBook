import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { createSnapshotFromDb } from "@/app/api/sync/createSnapshot";
import { broadcastSyncSuccess } from "@/app/api/sync/pusher";
import { SyncDataSchema } from "@/app/graph/SyncData";
import { getDb } from "@/db";
import { createNode, deleteNode, updateNode } from "@/db/graphNodes";
import { createRelation, deleteRelation, updateRelation } from "@/db/graphRelations";
import { upsertRelationList } from "@/db/relationLists";
import { createRelationType, deleteRelationType, updateRelationType } from "@/db/relationTypes";

export const GET = withAuth(getHandler);
async function getHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  const data = await createSnapshotFromDb(userId);
  return NextResponse.json({ data });
}

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  const parsedData = SyncDataSchema.safeParse(await req.json());

  if (!parsedData.success) {
    console.log(parsedData.error);
    return NextResponse.json({ status: "error", message: "Invalid sync data request" }, { status: 400 });
  }

  const { clientId, transactionId, updates } = parsedData.data;

  const db = getDb();

  try {
    // TODO: Probably use multi-select queries instead of this for loop stuff
    await db.transaction(async (tx) => {
      for (const update of updates) {
        switch (update.operation) {
          case "addNode":
            await createNode(tx, update.node);
            break;
          case "updateNode":
            await updateNode(tx, update.oldProps, update.newProps);
            break;
          case "deleteNode":
            await deleteNode(tx, update.node);
            break;
          case "addRelationType":
            await createRelationType(tx, update.relationType);
            break;
          case "updateRelationType":
            await updateRelationType(tx, update.oldProps, update.newProps);
            break;
          case "deleteRelationType":
            await deleteRelationType(tx, update.relationType);
            break;
          case "addRelation":
            await createRelation(tx, update.relation);
            break;
          case "updateRelation":
            await updateRelation(tx, update.oldProps, update.newProps);
            break;
          case "deleteRelation":
            await deleteRelation(tx, update.deleted.relation);
            break;
          case "updateRelationList":
            await upsertRelationList(
              tx,
              update.nodeId,
              update.authorId,
              update.pinned,
              update.relationId,
              update.newPosition,
            );
            break;
          default:
            update satisfies never;
        }
      }
    });
  } catch (e) {
    // Drizzle throws an error if the transaction is rolled back
    return NextResponse.json({ status: "error", message: "Error saving sync data" }, { status: 400 });
  }

  await broadcastSyncSuccess({ clientId, userId, transactionId, updates });

  return NextResponse.json({ status: "ok" });
}
