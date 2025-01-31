import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { graphNodeTable } from "@/db/schema";
import { getDb } from "@/db";
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params;
  const db = getDb();

  const nodes = await db
    .select({ id: graphNodeTable.id })
    .from(graphNodeTable)
    .where(eq(graphNodeTable.slug, slug))
    .limit(1);

  if (nodes.length <= 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const host = req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") || "http";

  return NextResponse.redirect(`${protocol}://${host}/g/${nodes[0].id}`, 302);
}
