import { uuid4 } from "@sentry/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { aiSearchQuery } from "@/app/api/search/aiSearchQuery";
import { answerQuery } from "@/app/api/search/answerQuery";

const AiSearchSchema = z.object({
  rootNodeId: z.string().optional(),
  query: z.string().min(3).includes(" "),
  createQueryNode: z.boolean(),
});

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  const sessionId = uuid4();
  console.time(sessionId);
  console.timeLog(sessionId, `[debug] In Search postHandler`);
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

  const data = await answerQuery(userId, query, sessionId);
  return NextResponse.json({ data });
}

export const GET = withAuth(getHandler);
async function getHandler(req: NextAuthenticatedRequest) {
  const sessionId = uuid4();
  console.time(sessionId);
  console.timeLog(sessionId, `[debug] In Search getHandler`);
  const userId = req.userId;
  const query = req.nextUrl.searchParams.get("query");
  const short_text = req.nextUrl.searchParams.get("short_text") === "true";

  if (!query || decodeURIComponent(query).length < 3) {
    throw Error("Missing search query or query too short");
  }

  const data = await answerQuery(userId, decodeURIComponent(query), sessionId, short_text);
  return NextResponse.json({ data });
}
