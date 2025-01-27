import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { createLayerWithCanonical } from "@/app/api/layer/createLayers";

export const GET = withAuth(getHandler);
async function getHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;

  const objectIds = req.nextUrl.searchParams.getAll("objectId");

  if (!objectIds || objectIds.length <= 0) {
    throw Error("Missing objects");
  }

  const data = await createLayerWithCanonical(userId, objectIds);
  return NextResponse.json({ data });
}
