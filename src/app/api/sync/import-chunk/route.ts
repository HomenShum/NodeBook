import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { UNLOGGED_USER } from "@/app/auth/NodeBookUser";
import { ImportChunkDataSchema } from "@/app/graph/SyncData";
import { applySyncReference, getBearerToken, getConvexClient } from "@/lib/convexServer";

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  if (request.userId === UNLOGGED_USER.id) {
    return NextResponse.json({ status: "error", message: "Authentication is required" }, { status: 401 });
  }
  const parsed = ImportChunkDataSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid import batch" }, { status: 400 });
  }
  try {
    const result = await getConvexClient(getBearerToken(request)).mutation(applySyncReference, {
      payload: JSON.stringify(parsed.data),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Graph import batch failed", error);
    return NextResponse.json({ status: "error", message: "Graph import batch failed" }, { status: 409 });
  }
});
