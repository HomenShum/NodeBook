import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import {
  deleteExpansionStateReference,
  getBearerToken,
  getConvexClient,
  getExpansionStateReference,
  saveExpansionStateReference,
} from "@/lib/convexServer";

const StateSchema = z.object({
  rootObjectId: z.string().min(1).max(2048),
  expandedObjects: z.array(z.string().max(4096)).max(10_000),
});

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  const parsed = StateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: true, message: "Invalid request body" }, { status: 400 });
  try {
    await getConvexClient(getBearerToken(request)).mutation(saveExpansionStateReference, parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Expansion state save failed", error);
    return NextResponse.json({ error: true, message: "Expansion state save failed" }, { status: 502 });
  }
});

export const GET = withAuth(async (request: NextAuthenticatedRequest) => {
  const rootObjectId = new URL(request.url).searchParams.get("rootObjectId");
  if (!rootObjectId) return NextResponse.json({ error: true, message: "rootObjectId is required" }, { status: 400 });
  try {
    const row = await getConvexClient(getBearerToken(request)).query(getExpansionStateReference, { rootObjectId });
    return NextResponse.json({
      data: row
        ? { authorId: row.ownerId, expandedObjects: row.expandedObjects, updatedAt: row.updatedAt }
        : null,
    });
  } catch (error) {
    console.error("Expansion state read failed", error);
    return NextResponse.json({ error: true, message: "Expansion state read failed" }, { status: 502 });
  }
});

export const DELETE = withAuth(async (request: NextAuthenticatedRequest) => {
  const rootObjectId = new URL(request.url).searchParams.get("rootObjectId");
  if (!rootObjectId) return NextResponse.json({ error: true, message: "rootObjectId is required" }, { status: 400 });
  try {
    await getConvexClient(getBearerToken(request)).mutation(deleteExpansionStateReference, { rootObjectId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Expansion state delete failed", error);
    return NextResponse.json({ error: true, message: "Expansion state delete failed" }, { status: 502 });
  }
});
