import { NextResponse } from "next/server";

import { withAuth } from "@/app/api/authMiddleware";
import { PostUserRequestSchema, PostUserResponse } from "@/app/api/types";
import { getDb } from "@/db";
import { getOrCreateUser } from "@/db/users";

export const POST = withAuth(postHandler);
async function postHandler(req: Request) {
  const body = await req.json();
  const result = PostUserRequestSchema.safeParse(body);
  if (!result.success) {
    console.error("Invalid request", result.error);
    return NextResponse.json({ error: true, message: "Invalid request" } satisfies PostUserResponse, { status: 400 });
  }
  try {
    const db = getDb();
    const { user } = result.data;
    const retrievedOrCreatedUser = await getOrCreateUser(db, user);
    return NextResponse.json({ error: false, data: retrievedOrCreatedUser } satisfies PostUserResponse);
  } catch (e) {
    console.error("Error creating user", e);
    return NextResponse.json({ error: true, message: "Error creating user" } satisfies PostUserResponse, {
      status: 500,
    });
  }
}
