import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { SerializedGraphStore } from "@/app/persistence/SerializedData";
import { getBearerToken, getConvexClient, searchNodesReference } from "@/lib/convexServer";

const SearchSchema = z.object({ query: z.string().trim().min(3).max(512) });

function graphResponse(documents: string[]): SerializedGraphStore {
  const nodesById: SerializedGraphStore["nodesById"] = {};
  for (const document of documents) {
    const node = JSON.parse(document);
    nodesById[node.id] = node;
  }
  return {
    usersById: {},
    nodesById,
    relationTypesById: {},
    relationsById: {},
    relationsByNodeId: {},
    pinnedRelationsByNodeId: {},
    noteContentRelationsByNodeId: {},
  };
}

async function search(request: NextAuthenticatedRequest, query: string) {
  const parsed = SearchSchema.safeParse({ query });
  if (!parsed.success) return NextResponse.json({ error: "Invalid search query" }, { status: 400 });
  try {
    const documents = await getConvexClient(getBearerToken(request)).query(searchNodesReference, {
      text: parsed.data.query,
      limit: 100,
    });
    return NextResponse.json({ data: graphResponse(documents) });
  } catch (error) {
    console.error("Search failed", error);
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}

export const GET = withAuth(async (request: NextAuthenticatedRequest) =>
  search(request, decodeURIComponent(new URL(request.url).searchParams.get("query") || "")),
);

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  const body = await request.json();
  return search(request, body.query || "");
});
