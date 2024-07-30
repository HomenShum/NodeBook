import { parse } from "url";

import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/app/api/authMiddleware";
import { createSnapshotFromDb } from "@/app/api/sync/createSnapshot";
import { broadcastSyncSuccess } from "@/app/api/sync/pusher";
import { SerializedSyncDataSchema } from "@/app/sync/SyncTask";
import { getDb } from "@/db";
import { createNode, deleteNode, updateNode } from "@/db/graphNodes";
import { createRelation, deleteRelation, updateRelation } from "@/db/graphRelations";
import { upsertRelationList } from "@/db/relationLists";
import { createRelationType, deleteRelationType, updateRelationType } from "@/db/relationTypes";

export const GET = withAuth(getHandler);
async function getHandler(req: NextRequest) {
  const { userId } = parse(req.url, true).query; // TODO: Figure out how to get it directly from NextRequest
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ status: "error", message: "Invalid user ID" }, { status: 400 });
  }
  const data = await createSnapshotFromDb(userId);
  return NextResponse.json({ data });
}

export const POST = withAuth(postHandler);
async function postHandler(req: NextRequest) {
  const parsedData = SerializedSyncDataSchema.safeParse(await req.json());

  if (!parsedData.success) {
    console.log(parsedData.error);
    return NextResponse.json({ status: "error", message: "Invalid sync data request" }, { status: 400 });
  }

  // TODO: At some point we'll want to validate user ID matches the user from auth, or just pull it directly from there
  const { userId, transactionId, updates } = parsedData.data;

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
            await upsertRelationList(tx, update.nodeId, update.authorId, update.listAfter, update.pinned);
            break;
          default:
            const _exhaustiveCheck: never = update;
        }
      }
    });
  } catch (e) {
    // Drizzle throws an error if the transaction is rolled back
    return NextResponse.json({ status: "error", message: "Error saving sync data" }, { status: 400 });
  }

  await broadcastSyncSuccess({ userId, transactionId, updates });

  return NextResponse.json({ status: "ok" });
}
