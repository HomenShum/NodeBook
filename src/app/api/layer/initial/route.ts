import { NextResponse } from "next/server";

import { withAuth } from "@/app/api/authMiddleware";

export const GET = withAuth(async () =>
  NextResponse.json({
    data: {
      usersById: {},
      nodesById: {},
      relationTypesById: {},
      relationsById: {},
      relationsByNodeId: {},
      pinnedRelationsByNodeId: {},
      noteContentRelationsByNodeId: {},
    },
  }),
);
