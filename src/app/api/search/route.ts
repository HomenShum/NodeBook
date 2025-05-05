import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { answerQuery } from "@/app/api/search/answerQuery";
import { aiSearchQuery } from "@/app/api/search/aiSearchQuery";

const AiSearchSchema = z.object({
  rootNodeId: z.string().optional(),
  query: z.string().min(3).includes(" "),
  createQueryNode: z.boolean(),
});

export const POST = withAuth(getHandler);
async function getHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  const body = await req.json();
  const parsedBody = AiSearchSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { rootNodeId, query, createQueryNode } = parsedBody.data;

  if (rootNodeId) {
    const data0 = await aiSearchQuery(userId, query, rootNodeId, createQueryNode, false);
    return NextResponse.json(data0);
  }

  const data = await answerQuery(userId, query);
  return NextResponse.json({ data });
}
