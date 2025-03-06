import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { getDb } from "@/db";
import { expansionStateTable } from "@/db/schema";
import rootLogger from "@/lib/logger";

const logger = rootLogger.child({ service: "expansion-state-api" });

const SaveExpansionStateSchema = z.object({
  rootObjectId: z.string(),
  expandedObjects: z.array(z.string()),
});

async function postHandler(req: NextAuthenticatedRequest) {
  try {
    const body = await req.json();
    const parsedBody = SaveExpansionStateSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: true, message: "Invalid request body" }, { status: 400 });
    }

    const { rootObjectId, expandedObjects } = parsedBody.data;
    const db = getDb();

    // Check if record already exists
    const existingState = await db
      .select()
      .from(expansionStateTable)
      .where(eq(expansionStateTable.rootObjectId, rootObjectId))
      .limit(1);

    if (existingState.length > 0) {
      // Update existing record
      await db
        .update(expansionStateTable)
        .set({
          authorId: req.userId, // Update to new author
          expandedObjects: JSON.stringify(expandedObjects),
          updatedAt: new Date(),
        })
        .where(eq(expansionStateTable.rootObjectId, rootObjectId));

      logger.debug(`Updated expansion state for rootObjectId: ${rootObjectId}`);
    } else {
      // Create new record
      await db.insert(expansionStateTable).values({
        authorId: req.userId,
        rootObjectId,
        expandedObjects: JSON.stringify(expandedObjects),
        updatedAt: new Date(),
      });

      logger.debug(`Created expansion state for rootObjectId: ${rootObjectId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error saving expansion state:", error);
    return NextResponse.json({ error: true, message: "Failed to save expansion state" }, { status: 500 });
  }
}

async function getHandler(req: NextAuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rootObjectId = searchParams.get("rootObjectId");

    if (!rootObjectId) {
      return NextResponse.json({ error: true, message: "rootObjectId is required" }, { status: 400 });
    }

    const db = getDb();
    const state = await db
      .select()
      .from(expansionStateTable)
      .where(eq(expansionStateTable.rootObjectId, rootObjectId))
      .limit(1);

    if (state.length === 0) {
      logger.debug(`No expansion state found for rootObjectId: ${rootObjectId}`);
      return NextResponse.json({ data: null });
    }

    logger.debug(`Found expansion state for rootObjectId: ${rootObjectId}`);
    return NextResponse.json({
      data: {
        authorId: state[0].authorId,
        expandedObjects: JSON.parse(state[0].expandedObjects),
        updatedAt: state[0].updatedAt,
      },
    });
  } catch (error) {
    logger.error("Error fetching expansion state:", error);
    return NextResponse.json({ error: true, message: "Failed to fetch expansion state" }, { status: 500 });
  }
}

async function deleteHandler(req: NextAuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rootObjectId = searchParams.get("rootObjectId");

    if (!rootObjectId) {
      return NextResponse.json({ error: true, message: "rootObjectId is required" }, { status: 400 });
    }

    const db = getDb();

    // Delete the record if it exists
    const result = await db.delete(expansionStateTable).where(eq(expansionStateTable.rootObjectId, rootObjectId));

    logger.debug(`Deleted expansion state for rootObjectId: ${rootObjectId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting expansion state:", error);
    return NextResponse.json({ error: true, message: "Failed to delete expansion state" }, { status: 500 });
  }
}

export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);
export const DELETE = withAuth(deleteHandler);
