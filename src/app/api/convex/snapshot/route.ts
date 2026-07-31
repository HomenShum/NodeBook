import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import {
  cleanupRelationListTombstonesReference,
  getBearerToken,
  getConvexClient,
  snapshotPageReference,
} from "@/lib/convexServer";

const RequestSchema = z.object({
  table: z.enum(["nodes", "relations", "relationTypes", "relationLists"]),
  visibility: z.enum(["owned", "public"]),
  cursor: z.string().max(4096).nullable(),
});

export const GET = withAuth(getHandler);

async function getHandler(request: NextAuthenticatedRequest) {
  const url = new URL(request.url);
  const parsed = RequestSchema.safeParse({
    table: url.searchParams.get("table"),
    visibility: url.searchParams.get("visibility"),
    cursor: url.searchParams.get("cursor"),
  });
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid snapshot page request" }, { status: 400 });
  }

  try {
    const client = getConvexClient(getBearerToken(request));
    if (
      parsed.data.table === "relationLists"
      && parsed.data.visibility === "owned"
      && parsed.data.cursor === null
    ) {
      await client.mutation(cleanupRelationListTombstonesReference, { limit: 100 });
    }
    const page = await client.query(snapshotPageReference, parsed.data);
    return NextResponse.json({ status: "ok", data: page });
  } catch (error) {
    console.error("Convex snapshot page failed", error);
    return NextResponse.json({ status: "error", message: "Convex snapshot page failed" }, { status: 502 });
  }
}
