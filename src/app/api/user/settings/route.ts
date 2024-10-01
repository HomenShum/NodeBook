import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { PostUserRequestSchema, PostUserResponse } from "@/app/api/types";
import { getDb } from "@/db";
import { updateUserSettings } from "@/db/users";

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
    await updateUserSettings(db, user);
    return NextResponse.json({ error: false, data: user } satisfies PostUserResponse);
  } catch (e) {
    console.error("Error creating user", e);
    captureException(e, { extra: { message: "Error updating user settings" } });
    return NextResponse.json({ error: true, message: "Error updating user settings" } satisfies PostUserResponse, {
      status: 500,
    });
  }
}
