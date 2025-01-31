import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { notificationTable } from "@/db/schema";
import { getDb } from "@/db";
import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";

export const GET = withAuth(getHandler);
async function getHandler(request: NextAuthenticatedRequest) {
  const db = getDb();
  const userNotifications = await db
    .select()
    .from(notificationTable)
    .where(eq(notificationTable.userId, request.userId));
  return NextResponse.json(userNotifications);
}

export const POST = withAuth(postHandler);
async function postHandler(request: NextAuthenticatedRequest) {
  const body = await request.json();
  const db = getDb();

  const { nodeId, userId }: { nodeId: string; userId: string } = body;

  if (!nodeId || !userId) {
    return NextResponse.json({ error: "Invalid request body" });
  }

  await db.insert(notificationTable).values({
    userId,
    messageContent: { mentionedById: request.userId, nodeId },
    isRead: false,
    createdAt: new Date(),
  });
  return NextResponse.json({ success: true });
}

export const PATCH = withAuth(patchHandler);
async function patchHandler(request: NextAuthenticatedRequest) {
  const db = getDb();
  const body = await request.json();
  const notificationId: string | null | undefined = body.notificationId;

  if (notificationId) {
    await db
      .update(notificationTable)
      .set({ isRead: true })
      .where(and(eq(notificationTable.id, notificationId), eq(notificationTable.userId, request.userId)));
  } else {
    await db.update(notificationTable).set({ isRead: true }).where(eq(notificationTable.userId, request.userId));
  }
  return NextResponse.json({ success: true });
}
