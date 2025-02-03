import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { answerQuery } from "@/app/api/search/answerQuery";

export const GET = withAuth(getHandler);
async function getHandler(req: NextAuthenticatedRequest) {
  const userId = req.userId;
  const query = req.nextUrl.searchParams.get("query");

  if (!query || decodeURIComponent(query).length < 3) {
    throw Error("Missing search query or query too short");
  }

  const data = await answerQuery(userId, decodeURIComponent(query));
  return NextResponse.json({ data });
}
