import { captureException } from "@sentry/nextjs";
import { eq, not } from "drizzle-orm";
import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable, relationListsTable, relationTypeTable } from "@/db/schema";
import { env } from "@/envBackend";
import { GLOBAL_ADMIN_USER_ID } from "@/lib/constants";

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  if (env.STAGE === "production") {
    return NextResponse.json(
      { status: "error", message: "This endpoint is not available in production" },
      { status: 403 },
    );
  }

  const userId = req.userId;
  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      await tx.delete(graphNodeTable).where(not(eq(graphNodeTable.authorId, GLOBAL_ADMIN_USER_ID)));
      await tx.delete(graphRelationTable).where(not(eq(graphRelationTable.authorId, GLOBAL_ADMIN_USER_ID)));
      await tx.delete(relationListsTable).where(not(eq(relationListsTable.authorId, GLOBAL_ADMIN_USER_ID)));
      await tx.delete(relationTypeTable).where(not(eq(relationTypeTable.authorId, GLOBAL_ADMIN_USER_ID)));
    });
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error(e);
    captureException(e, {
      user: { id: userId },
      extra: { message: "Error deleting all data" },
    });
    return NextResponse.json({ status: "error", message: "Error deleting all data" }, { status: 500 });
  }
}
