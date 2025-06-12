import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { createInitialLayers } from "@/app/api/layer/createLayers";

export const GET = withAuth(getHandler);
async function getHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;

  const data = await createInitialLayers(userId);
  return NextResponse.json({ data });
}
