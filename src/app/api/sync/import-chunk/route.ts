import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { broadcastSyncSuccess } from "@/app/api/sync/pusher";
import { AddNode, AddRelation, AddRelationType } from "@/app/graph/GraphUpdate";
import { ImportChunkDataSchema } from "@/app/graph/SyncData";
import { getDb } from "@/db";
import { createNodes } from "@/db/graphNodes";
import { createRelations } from "@/db/graphRelations";
import { createRelationTypes } from "@/db/relationTypes";

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  const parsedData = ImportChunkDataSchema.safeParse(await req.json());

  if (!parsedData.success) {
    console.log(parsedData.error);
    return NextResponse.json(
      {
        status: "error",
        message: "Invalid import sync data type. Hint: the import data can have only one type of GraphUpdate.",
      },
      { status: 400 },
    );
  }

  const { clientId, transactionId, updates } = parsedData.data;

  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const firstOperation = updates[0].operation;

      switch (firstOperation) {
        case "addNode":
          const nodeUpdates = updates as AddNode[];
          await createNodes(
            tx,
            nodeUpdates.map((update) => update.node),
          );
          break;
        case "addRelation":
          const relUpdates = updates as AddRelation[];
          await createRelations(
            tx,
            relUpdates.map((update) => update.relation),
          );
          break;
        case "addRelationType":
          const relTypeUpdates = updates as AddRelationType[];
          await createRelationTypes(
            tx,
            relTypeUpdates.map((update) => update.relationType),
          );
          break;
        case "updateRelationList":
          return NextResponse.json(
            { status: "error", message: "importing updateRelationLists not implemented" },
            { status: 400 },
          );
        default:
          return NextResponse.json(
            { status: "error", message: "Import update operation not implemented: ".concat(firstOperation) },
            { status: 400 },
          );
      }
    });
  } catch (e) {
    // Drizzle throws an error if the transaction is rolled back
    // Return first 10 update types in the updates list as the error message
    return NextResponse.json(
      {
        status: "error",
        message: updates
          .slice(0, 10)
          .map((update) => update.operation)
          .join(", "),
      },
      { status: 400 },
    );
  }

  await broadcastSyncSuccess({ clientId, userId, transactionId, updates });

  return NextResponse.json({ status: "ok" });
}
