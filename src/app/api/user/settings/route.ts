import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { PostUserRequestSchema, PostUserResponse } from "@/app/api/types";
import { UNLOGGED_USER } from "@/app/auth/NodeBookUser";
import {
  getBearerToken,
  getConvexClient,
  updateUserSettingsReference,
} from "@/lib/convexServer";

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  if (req.userId === UNLOGGED_USER.id) {
    return NextResponse.json(
      { status: "error", message: "Cannot update data as unauthenticated user" },
      { status: 401 },
    );
  }

  const body = await req.json();
  const result = PostUserRequestSchema.safeParse(body);

  if (!result.success) {
    console.error("Invalid request", result.error);
    captureException(result.error, { extra: { message: "Invalid request" } });
    return NextResponse.json({ error: true, message: "Invalid request" } satisfies PostUserResponse, { status: 400 });
  }

  try {
    const { user } = result.data;
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: true, message: "Authentication is required" } satisfies PostUserResponse, {
        status: 401,
      });
    }
    const document = await getConvexClient(token).mutation(updateUserSettingsReference, {
      payload: JSON.stringify(user),
    });
    return NextResponse.json({ error: false, data: JSON.parse(document) } satisfies PostUserResponse);
  } catch (e) {
    console.error("Error creating user", e);
    captureException(e, { extra: { message: "Error updating user settings" } });
    return NextResponse.json({ error: true, message: "Error updating user settings" } satisfies PostUserResponse, {
      status: 500,
    });
  }
}
