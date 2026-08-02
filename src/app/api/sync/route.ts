import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { UNLOGGED_USER } from "@/app/auth/NodeBookUser";
import { SyncDataSchema } from "@/app/graph/SyncData";
import { applySyncReference, getBearerToken, getConvexClient } from "@/lib/convexServer";

function syncConflictCode(error: unknown) {
  const match = (error instanceof Error ? error.message : String(error)).match(/"code"\s*:\s*"([A-Z_]{3,40})"/);
  return match?.[1] ?? "UNKNOWN_CONFLICT";
}

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  if (request.userId === UNLOGGED_USER.id) {
    return NextResponse.json({ status: "error", message: "Authentication is required" }, { status: 401 });
  }
  const parsed = SyncDataSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid sync data request" }, { status: 400 });
  }
  try {
    const result = await getConvexClient(getBearerToken(request)).mutation(applySyncReference, {
      payload: JSON.stringify(parsed.data),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Graph sync failed", error);
    captureException(error, { user: { id: request.userId }, extra: { message: "Graph sync failed" } });
    return NextResponse.json({ status: "error", message: `Graph sync conflict (${syncConflictCode(error)})` }, { status: 409 });
  }
});
