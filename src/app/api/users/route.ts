import { captureException } from "@sentry/nextjs";
import { inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { GetUsersRequest, GetUsersRequestSchema, GetUsersResponse } from "@/app/api/types";
import { MewUserPublic } from "@/app/persistence/SerializedData";
import { getDb } from "@/db";
import { userTable } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = GetUsersRequestSchema.safeParse(body);

    if (!result.success) {
      console.error("Invalid request", result.error);
      captureException(result.error, { extra: { message: "Invalid request" } });
      return NextResponse.json(
        { error: true, message: "Invalid request" } satisfies GetUsersResponse,
        { status: 400 }
      );
    }

    const { userIds } = result.data;

    if (userIds.length === 0) {
      return NextResponse.json({
        error: false,
        data: [],
      } satisfies GetUsersResponse);
    }

    const db = getDb();
    const userRows = await db
      .select()
      .from(userTable)
      .where(inArray(userTable.id, userIds));

    const users: MewUserPublic[] = userRows.map((row) => ({
      id: row.id,
      username: row.username || row.email!,
      email: row.email!,
    }));

    return NextResponse.json({
      error: false,
      data: users,
    } satisfies GetUsersResponse);
  } catch (e) {
    console.error("Error fetching users", e);
    captureException(e, { extra: { message: "Error fetching users" } });
    return NextResponse.json(
      { error: true, message: "Error fetching users" } satisfies GetUsersResponse,
      { status: 500 }
    );
  }
}
