import { captureException } from "@sentry/nextjs";
import { inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { readCacheSchema, updateCacheSchema } from "@/app/api/cache/canonical/types";
import { getDb } from "@/db";
import { canonicalPathCacheTable } from "@/db/schema";

async function putHandler(req: NextRequest) {
  const db = getDb();

  const parsedRequest = updateCacheSchema.safeParse(await req.json());

  if (!parsedRequest.success) {
    return NextResponse.json({ status: "error", message: "Invalid request" }, { status: 400 });
  }

  const objectIds = Object.keys(parsedRequest.data);

  try {
    await db
      .insert(canonicalPathCacheTable)
      .values(
        objectIds.map((objectId) => ({
          objectId,
          ancestors: parsedRequest.data[objectId],
        })),
      )
      .onConflictDoUpdate({
        target: [canonicalPathCacheTable.objectId],
        set: { ancestors: sql`excluded.ancestors` },
      });
  } catch (e) {
    console.error(e);
    captureException(e, {
      extra: { message: "Error updating canonical path cache" },
    });
  }
  return NextResponse.json({ status: "ok" });
}

async function postHandler(req: NextRequest) {
  const db = getDb();

  const parsedRequest = readCacheSchema.safeParse(await req.json());

  if (!parsedRequest.success) {
    return NextResponse.json({ status: "error", message: "Invalid request" }, { status: 400 });
  }

  const objectIds = parsedRequest.data.objectIds;

  const cache = await db
    .select({
      objectId: canonicalPathCacheTable.objectId,
      ancestors: canonicalPathCacheTable.ancestors,
    })
    .from(canonicalPathCacheTable)
    .where(inArray(canonicalPathCacheTable.objectId, objectIds));

  return NextResponse.json({ status: "ok", data: cache });
}

export { postHandler as POST, putHandler as PUT };
