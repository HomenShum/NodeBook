import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { createSnapshotFromDb } from "@/app/api/sync/createSnapshot";
import { broadcastSyncSuccess } from "@/app/api/sync/pusher";
import { UNLOGGED_USER } from "@/app/auth/MewUser";
import { SyncDataSchema } from "@/app/graph/SyncData";
import { getDb } from "@/db";
import { createNodes, deleteNode, updateNode } from "@/db/graphNodes";
import { createRelations, deleteRelation, updateRelation } from "@/db/graphRelations";
import { upsertRelationList } from "@/db/relationLists";
import { createRelationTypes, deleteRelationType, updateRelationType } from "@/db/relationTypes";
import { formatSyncErrorForLog, SyncError } from "@/db/SyncError";

export const GET = withAuth(getHandler);
async function getHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  const data = await createSnapshotFromDb(userId);
  return NextResponse.json({ data });
}

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  if (userId === UNLOGGED_USER.id) {
    return NextResponse.json(
      { status: "error", message: "Cannot update data as unauthenticated user" },
      { status: 401 },
    );
  }

  console.log("Sync data request for user", userId);

  const parsedData = SyncDataSchema.safeParse(await req.json());

  if (!parsedData.success) {
    console.error(parsedData.error);
    captureException(parsedData.error, { extra: { message: "Invalid sync data request" } });
    return NextResponse.json({ status: "error", message: "Invalid sync data request" }, { status: 400 });
  }

  const { clientId, transactionId, updates } = parsedData.data;

  const db = getDb();

  try {
    console.log(`[sync][${userId}] Applying ${updates.length} updates`, updates);
    // TODO: Probably use multi-select queries instead of this for loop stuff
    await db.transaction(async (tx) => {
      for (const update of updates) {
        switch (update.operation) {
          case "addNode":
            await createNodes(tx, [update.node]);
            break;
          case "updateNode":
            await updateNode(tx, update.oldProps, update.newProps);
            break;
          case "deleteNode":
            await deleteNode(tx, update.node);
            break;
          case "addRelationType":
            await createRelationTypes(tx, [update.relationType]);
            break;
          case "updateRelationType":
            await updateRelationType(tx, update.oldProps, update.newProps);
            break;
          case "deleteRelationType":
            await deleteRelationType(tx, update.relationType);
            break;
          case "addRelation":
            await createRelations(tx, [update.relation]);
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
              update.newIsPublic,
            );
            break;
          default:
            update satisfies never;
        }
      }
    });
  } catch (e) {
    // If any error is thrown, Drizzle rolls back the transaction for us
    if (e instanceof SyncError) {
      console.error(formatSyncErrorForLog(e, { userId }), e.data);
      captureException(e, { user: { id: userId }, extra: { data: e.data } });
    } else {
      console.error(e);
      captureException(e, { user: { id: userId }, extra: { message: "Error saving sync data" } });
    }
    return NextResponse.json({ status: "error", message: "Error saving sync data" }, { status: 400 });
  }

  console.log(`[sync][${userId}] All updates applied successfully`);

  await broadcastSyncSuccess({ clientId, userId, transactionId, updates });

  return NextResponse.json({ status: "ok" });
}
