import { createClient } from "redis";
import { NextRequest, NextResponse } from "next/server";

// @ts-ignore
function parseRedisFieldArray(arr) {
  const obj = {};
  for (let i = 0; i < arr.length; i += 2) {
    // @ts-ignore
    obj[arr[i]] = arr[i + 1];
  }
  return obj;
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");

  if (!query) {
    return NextResponse.json(
      { error: "Missing query param `query`" },
      {
        status: 400,
      },
    );
  }

  const results = [];
  try {
    //Don't you just love hard coding secrets?
    const client = await createClient({
      url: "redis://default:S0KsG4fKZkzYio3iTfDbiHfGCR1SB493@redis-19335.c24.us-east-mz-1.ec2.redns.redis-cloud.com:19335",
    }).connect();

    const raw = await client.sendCommand(["FT.SEARCH", "idx", `@text:${query}*`]);
    //      console.log(raw);
    // @ts-ignore
    for (let i = 1; i < raw.length; i += 2) {
      // @ts-ignore
      const docKey = raw[i];
      // @ts-ignore
      const fieldArray = raw[i + 1];
      const fields = parseRedisFieldArray(fieldArray);

      results.push({
        // @ts-ignore
        id: fields.id || docKey.replace("doc:", ""),
        // @ts-ignore
        text: fields.text || "",
      });
    }
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json(results);
}
