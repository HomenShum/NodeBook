import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { GetUsersRequestSchema, GetUsersResponse } from "@/app/api/types";
import { NodeBookUserPublic } from "@/app/persistence/SerializedData";
import { getBearerToken, getConvexClient, listUsersReference } from "@/lib/convexServer";

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  try {
    const parsed = GetUsersRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: true, message: "Invalid request" } satisfies GetUsersResponse, { status: 400 });
    }
    const documents = await getConvexClient(getBearerToken(request)).query(listUsersReference, parsed.data);
    const data: NodeBookUserPublic[] = documents.map((document) => {
      const user = JSON.parse(document);
      return { id: user.id, username: user.username || user.email, email: user.email };
    });
    return NextResponse.json({ error: false, data } satisfies GetUsersResponse);
  } catch (error) {
    console.error("User lookup failed", error);
    captureException(error, { extra: { message: "User lookup failed" } });
    return NextResponse.json({ error: true, message: "User lookup failed" } satisfies GetUsersResponse, { status: 502 });
  }
});
