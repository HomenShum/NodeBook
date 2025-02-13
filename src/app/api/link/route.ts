import { NextResponse } from "next/server";
import { z } from "zod";
import { unfurl } from "unfurl.js";
import { FetchError } from "node-fetch";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import logger from "@/lib/logger";

const bodySchema = z.object({
  url: z.string().url(),
});

const cache: Record<string, string> = {};

export const POST = withAuth(postHandler);
async function postHandler(req: NextAuthenticatedRequest) {
  const body = bodySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 });
  }

  const url = body.data.url;

  if (cache[url] !== undefined) {
    return NextResponse.json({ title: cache[url] });
  }

  try {
    const meta = await unfurl(url, { timeout: 3000, oembed: false });
    const title = meta.title ?? meta.description ?? "";
    if (!title) {
      logger.warn("Link unfurling returned no title", { url, meta });
    }
    cache[url] = title;
    return NextResponse.json({ title });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Invalid URL") || message.includes("Only HTTP(S) protocols are supported")) {
      return NextResponse.json({ error: "invalid-url" }, { status: 400 });
    }
    if (err instanceof FetchError) {
      if (err.type === "request-timeout") {
        return NextResponse.json({ error: "request-timeout" }, { status: 400 });
      }
      if (err.errno === "ENOTFOUND") {
        return NextResponse.json({ error: "url-doesnt-exit" }, { status: 400 });
      }
    }
    // Send the unknown error
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
