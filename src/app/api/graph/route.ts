import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GetGraphResponse } from "./types";
import { PostGraphRequestSchema, PostGraphResponse } from "./types";

export async function GET() {
  const db = getDb();
  const nodes = await db.select().from(graphNodeTable);
  const relations = await db.select().from(graphRelationTable);
  const response: GetGraphResponse = { nodes, relations };
  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const data = PostGraphRequestSchema.parse(body);
  let response: PostGraphResponse;
  try {
    if (data.type === "upsert") {
      const { nodes, relations } = data;
      await db.transaction(async (trx) => {
        await Promise.all(
          nodes?.map((node) => {
            return db
              .insert(graphNodeTable)
              .values(node)
              .onConflictDoUpdate({ target: graphNodeTable.id, set: { text: node.text } });
          }) ?? []
        );
        await Promise.all(
          relations?.map((relation) => {
            return db
              .insert(graphRelationTable)
              .values(relation)
              .onConflictDoUpdate({
                target: graphRelationTable.id,
                set: { fromId: relation.fromId, toId: relation.toId, typeId: relation.typeId },
              });
          }) ?? []
        );
      });
      response = { success: true, message: "success" };
    } else if (data.type === "delete") {
      const { nodes, relations } = data;
      await db.transaction(async (trx) => {
        await Promise.all(
          nodes?.map((node) => {
            return db.delete(graphNodeTable).where(eq(graphNodeTable.id, node.id));
          }) ?? []
        );
        await Promise.all(
          relations?.map((relation) => {
            return db.delete(graphRelationTable).where(eq(graphRelationTable.id, relation.id));
          }) ?? []
        );
      });
      response = { success: true, message: "success" };
    } else {
      throw new Error("invalid type");
    }
  } catch (e) {
    console.error(e);
    response = { success: false, message: e instanceof Error ? e.message : "unknown error" };
    return NextResponse.json(response, { status: 500 });
  }
  return NextResponse.json(response);
}

export async function DELETE() {
  const db = getDb();
  try {
    await db.delete(graphNodeTable);
    await db.delete(graphRelationTable);
    return NextResponse.json({ success: true, message: "success" });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}
