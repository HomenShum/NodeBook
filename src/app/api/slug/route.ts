import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { graphNodeTable } from "@/db/schema";

//Todo: Add auth later
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const { nodeId, slug } = await req.json();

    if (!nodeId || !slug) {
      return NextResponse.json({ error: "Both nodeId and slug are required." }, { status: 400 });
    }

    const nodes = await db
      .select({ id: graphNodeTable.id })
      .from(graphNodeTable)
      .where(eq(graphNodeTable.slug, slug))
      .limit(1);

    if (nodes.length >= 1) {
      return NextResponse.json({ error: "Slug is already in use." }, { status: 409 });
    }

    const result = await db.update(graphNodeTable).set({ slug }).where(eq(graphNodeTable.id, nodeId)).returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Node ID not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Slug updated successfully." }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const nodeId = req.nextUrl.searchParams.get("nodeId");

    if (!nodeId) {
      return NextResponse.json({ error: "nodeId is required." }, { status: 404 });
    }

    const nodes = await db
      .select({ slug: graphNodeTable.slug, id: graphNodeTable.id })
      .from(graphNodeTable)
      .where(eq(graphNodeTable.id, nodeId))
      .limit(1);

    return NextResponse.json({ slug: nodes.length > 0 ? nodes[0].slug : null, id: nodes[0].id });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
