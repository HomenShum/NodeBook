import { NextResponse } from "next/server";
import Pusher from "pusher";

import { createSnapshotFromDb } from "@/app/api/sync/createSnapshot";
import { GraphRelation } from "@/app/graph/GraphRelation";
import {
  SerializedGraphNode,
  SerializedPositionList,
  SerializedRelation,
  SerializedSyncData,
} from "@/app/persistence/SerializedData";
import { getDb } from "@/db";
import { deleteNode, upsertNode } from "@/db/graphNodes";
import { deleteRelation, upsertRelation } from "@/db/graphRelations";
import { upsertRelationList } from "@/db/relationLists";
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
  const body = await req.json();

  if (!body || typeof body !== "object" || !body.transactionId || !body.transaction || !body.result) {
    return NextResponse.json({ status: "error", message: "Invalid sync data request" }, { status: 400 });
  }

  const { transactionId, transaction, result } = body;
  if (!result || typeof result !== "object" || !(result satisfies SerializedSyncData)) {
    return NextResponse.json({ status: "error", message: "Invalid sync data request" }, { status: 400 });
  }

  const nodes: SerializedGraphNode[] = result.nodes ?? [];
  const nodesDeleted: SerializedGraphNode[] = result.nodesDeleted ?? [];
  const relations: SerializedRelation[] = result.relations ?? [];
  const relationsDeleted: SerializedRelation[] = result.relationsDeleted ?? [];
  const relationLists: Record<string, SerializedPositionList<GraphRelation>> = result.relationLists ?? {};
  const pinnedRelationLists: Record<string, SerializedPositionList<GraphRelation>> = result.pinnedRelationLists ?? {};

  const db = getDb();

  try {
    // TODO: Probably use multi-select queries instead of this for loop stuff
    await db.transaction(async (tx) => {
      for (const relation of relationsDeleted) {
        await deleteRelation(tx, relation);
      }
      for (const node of nodesDeleted) {
        await deleteNode(tx, node);
      }
      for (const node of nodes) {
        await upsertNode(tx, node);
      }
      for (const relation of relations) {
        await upsertRelation(tx, relation);
      }
      for (const [nodeId, relationList] of Object.entries(relationLists)) {
        await upsertRelationList(tx, nodeId, relationList, false);
      }
      for (const [nodeId, relationList] of Object.entries(pinnedRelationLists)) {
        await upsertRelationList(tx, nodeId, relationList, true);
      }
    });
  } catch (e) {
    console.log(e);
    // Drizzle throws an error if the transaction is rolled back
    return NextResponse.json({ status: "error", message: "Error saving sync data" }, { status: 400 });
  }

  pusher.trigger("mew-sync-channel", "transaction-accepted", { transactionId, transaction, result });

  return NextResponse.json({ status: "ok" });
}
