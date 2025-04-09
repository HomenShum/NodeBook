import { and, eq, isNotNull, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

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

    if (slug.includes("/") || slug === "home") {
      return NextResponse.json({ error: "Slug cannot include / or be home" }, { status: 400 });
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

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { nodeId } = await req.json();

    if (!nodeId) {
      return NextResponse.json({ error: "Missing nodeId" }, { status: 400 });
    }

    await db.update(graphNodeTable).set({ slug: null }).where(eq(graphNodeTable.id, nodeId));

    return NextResponse.json({ message: "Deleted slug successfully." }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const nodeId = req.nextUrl.searchParams.get("nodeId");
    const slug = req.nextUrl.searchParams.get("slug");

    let nodes = [];

    if (nodeId) {
      nodes = await db
        .select({ slug: graphNodeTable.slug, id: graphNodeTable.id })
        .from(graphNodeTable)
        .where(eq(graphNodeTable.id, nodeId))
        .limit(1);
    } else if (slug) {
      nodes = await db
        .select({ slug: graphNodeTable.slug, id: graphNodeTable.id })
        .from(graphNodeTable)
        .where(eq(graphNodeTable.slug, slug))
        .limit(1);
    } else {
      nodes = await db
        .select({ slug: graphNodeTable.slug, id: graphNodeTable.id })
        .from(graphNodeTable)
        .where(and(isNotNull(graphNodeTable.slug), ne(graphNodeTable.slug, "")));
    }

    return NextResponse.json({
      nodes,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
