import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const data = await sql`SELECT * FROM data WHERE id = 1;`;
  if (data.rowCount === 1) {
    return NextResponse.json({ data: data.rows[0].json });
  }
  return NextResponse.json({ data: null });
}

export async function POST(req: Request) {
  const body = await req.json();

  const dataString = body.data;
  await sql`INSERT INTO data (id, json)
  VALUES (1, ${dataString})
  ON CONFLICT (id) DO UPDATE SET json = EXCLUDED.json;`;

  return NextResponse.json({ status: "ok" });
}
