import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import {
  createNotificationReference,
  getBearerToken,
  getConvexClient,
  listNotificationsReference,
  markNotificationsReadReference,
} from "@/lib/convexServer";

const CreateSchema = z.object({ nodeId: z.string().min(1).max(2048), userId: z.string().min(1).max(2048) });
const MarkSchema = z.object({ notificationId: z.string().optional() });

export const GET = withAuth(async (request: NextAuthenticatedRequest) => {
  try {
    const data = await getConvexClient(getBearerToken(request)).query(listNotificationsReference, {});
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    console.error("Notification read failed", error);
    return NextResponse.json({ status: "error", message: "Notification read failed" }, { status: 502 });
  }
});

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  try {
    await getConvexClient(getBearerToken(request)).mutation(createNotificationReference, parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification create failed", error);
    return NextResponse.json({ error: "Notification create failed" }, { status: 502 });
  }
});

export const PATCH = withAuth(async (request: NextAuthenticatedRequest) => {
  const parsed = MarkSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  try {
    await getConvexClient(getBearerToken(request)).mutation(markNotificationsReadReference, parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification update failed", error);
    return NextResponse.json({ error: "Notification update failed" }, { status: 502 });
  }
});
