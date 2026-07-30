import { NextResponse } from "next/server";

import { withAuth } from "@/app/api/authMiddleware";

const emptyGraph = {
  usersById: {},
  nodesById: {},
  relationTypesById: {},
  relationsById: {},
  relationsByNodeId: {},
  pinnedRelationsByNodeId: {},
  noteContentRelationsByNodeId: {},
};

export const POST = withAuth(async () => NextResponse.json({ data: emptyGraph }));
