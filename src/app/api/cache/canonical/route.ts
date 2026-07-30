import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { readCacheSchema, updateCacheSchema } from "@/app/api/cache/canonical/types";
import {
  getBearerToken,
  getConvexClient,
  readCanonicalPathsReference,
  writeCanonicalPathsReference,
} from "@/lib/convexServer";

export const PUT = withAuth(async (request: NextAuthenticatedRequest) => {
  const parsed = updateCacheSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ status: "error", message: "Invalid request" }, { status: 400 });
  if (process.env.NEXT_PUBLIC_PERSISTENCE_ENABLED !== "true") {
    return NextResponse.json({ status: "ok" });
  }
  try {
    const entries = Object.entries(parsed.data).map(([objectId, ancestors]) => ({ objectId, ancestors }));
    await getConvexClient(getBearerToken(request)).mutation(writeCanonicalPathsReference, { entries });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Canonical cache update failed", error);
    return NextResponse.json({ status: "error", message: "Canonical cache update failed" }, { status: 502 });
  }
});

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  const parsed = readCacheSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ status: "error", message: "Invalid request" }, { status: 400 });
  if (process.env.NEXT_PUBLIC_PERSISTENCE_ENABLED !== "true") {
    return NextResponse.json({ status: "ok", data: [] });
  }
  try {
    const data = await getConvexClient(getBearerToken(request)).query(readCanonicalPathsReference, parsed.data);
    return NextResponse.json({ status: "ok", data });
  } catch (error) {
    console.error("Canonical cache read failed", error);
    return NextResponse.json({ status: "error", message: "Canonical cache read failed" }, { status: 502 });
  }
});
