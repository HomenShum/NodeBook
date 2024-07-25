import { NextResponse } from "next/server";

import { withAuth } from "@/app/api/authMiddleware";
import { getDb } from "@/db";
import { UserSchema } from "@/db/schema";
import { getOrCreateUser } from "@/db/users";

export const POST = withAuth(postHandler);
async function postHandler(req: Request) {
  const body = await req.json();

  if (!body || typeof body !== "object" || !body.user) {
    return NextResponse.json({ status: "error", message: "Invalid user request" }, { status: 400 });
  }

  const user = UserSchema.safeParse(body.user);
  if (!user.success) {
    return NextResponse.json({ status: "error", message: "Invalid user data" }, { status: 400 });
  }

  const db = getDb();

  const retrievedOrCreatedUser = await getOrCreateUser(db, user.data);

  return NextResponse.json(retrievedOrCreatedUser);
}
