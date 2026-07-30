import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { env } from "@/envBackend";
import { deleteOwnerDataPageReference, getBearerToken, getConvexClient } from "@/lib/convexServer";

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  if (env.STAGE === "production") {
    return NextResponse.json({ status: "error", message: "This endpoint is disabled in production" }, { status: 403 });
  }
  try {
    const client = getConvexClient(getBearerToken(request));
    let deleted = 0;
    for (let page = 0; page < 20; page++) {
      const result = await client.mutation(deleteOwnerDataPageReference, {});
      deleted += result.deleted;
      if (!result.hasMore) return NextResponse.json({ status: "ok", deleted });
    }
    return NextResponse.json({ status: "error", message: "Deletion page budget exhausted", deleted }, { status: 409 });
  } catch (error) {
    console.error("Delete-all failed", error);
    return NextResponse.json({ status: "error", message: "Delete-all failed" }, { status: 502 });
  }
});
