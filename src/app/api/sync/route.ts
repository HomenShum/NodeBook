import { NextResponse } from "next/server";
import Pusher from "pusher";

import { createSnapshotFromDb } from "@/app/api/sync/createSnapshot";
import { SerializedSyncDataSchema } from "@/app/sync/SyncTask";
import { getDb } from "@/db";
import { createNode, deleteNode, updateNode } from "@/db/graphNodes";
import { createRelation, deleteRelation, updateRelation } from "@/db/graphRelations";
import { upsertRelationList } from "@/db/relationLists";
import { createRelationType, deleteRelationType, updateRelationType } from "@/db/relationTypes";
import { env } from "@/envBackend";

const pusher = new Pusher({
  appId: env.PUSHER_APP_ID ?? "",
  key: env.PUSHER_KEY ?? "",
  secret: env.PUSHER_SECRET ?? "",
  cluster: env.PUSHER_CLUSTER ?? "",
});

export async function GET(req: Request) {
  const data = await createSnapshotFromDb();
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const parsedData = SerializedSyncDataSchema.safeParse(await req.json());

  if (!parsedData.success) {
    console.log(parsedData.error);
    return NextResponse.json({ status: "error", message: "Invalid sync data request" }, { status: 400 });
  }

  const { transactionId, updates } = parsedData.data;

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
            await upsertRelationList(tx, update.nodeId, update.listAfter, update.pinned);
            break;
          default:
            const _exhaustiveCheck: never = update;
        }
      }
    });
  } catch (e) {
    console.log(e);
    // Drizzle throws an error if the transaction is rolled back
    return NextResponse.json({ status: "error", message: "Error saving sync data" }, { status: 400 });
  }

  pusher.trigger("mew-sync-channel", "transaction-accepted", { transactionId, updates });

  return NextResponse.json({ status: "ok" });
}
