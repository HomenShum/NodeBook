import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { PostUserRequestSchema, PostUserResponse } from "@/app/api/types";
import { getDb } from "@/db";
import { getOrCreateUser } from "@/db/users";

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  const body = await req.json();
  const result = PostUserRequestSchema.safeParse(body);
  if (!result.success) {
    console.error("Invalid request", result.error);
    captureException(result.error, { extra: { message: "Invalid request" } });
    return NextResponse.json({ error: true, message: "Invalid request" } satisfies PostUserResponse, { status: 400 });
  }
  try {
    const db = getDb();
    const { user } = result.data;
    const retrievedOrCreatedUser = await getOrCreateUser(db, user);
    return NextResponse.json({ error: false, data: retrievedOrCreatedUser } satisfies PostUserResponse);
  } catch (e) {
    console.error("Error creating user", e);
    captureException(e, { extra: { message: "Error creating user" } });
    return NextResponse.json({ error: true, message: "Error creating user" } satisfies PostUserResponse, {
      status: 500,
    });
  }
}
