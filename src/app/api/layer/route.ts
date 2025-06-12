import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { createLayers } from "@/app/api/layer/createLayers";

const bodySchema = z.object({ objectIds: z.array(z.string()) });

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  const body = bodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 });
  }
  const objectIds = body.data.objectIds;

  if (!objectIds || objectIds.length <= 0) {
    throw Error("Missing objects");
  }

  // Load connected layers for regular layer loading (not search)
  const data = await createLayers(userId, objectIds, 1, true);
  return NextResponse.json({ data });
}
