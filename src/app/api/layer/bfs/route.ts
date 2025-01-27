import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { createLayersWithBfs } from "@/app/api/layer/createLayers";

export const GET = withAuth(getHandler);
async function getHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  const objectId = req.nextUrl.searchParams.get("objectId");

  if (!objectId || objectId.length < 4) {
    throw Error("Missing objectId or invalid objectId");
  }

  const data = await createLayersWithBfs(userId, objectId);
  return NextResponse.json({ data });
}
