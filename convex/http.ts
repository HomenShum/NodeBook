import { httpRouter, makeFunctionReference } from "convex/server";
import { httpActionGeneric } from "convex/server";

const http = httpRouter();
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const importBatchReference = makeFunctionReference<"mutation">("migration:importBatch");
const clearOwnerGraphReference = makeFunctionReference<"mutation">("migration:clearOwnerGraph");

async function readBoundedRequest(request: Request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

http.route({
  path: "/migration/import",
  method: "POST",
  handler: httpActionGeneric(async (ctx, request) => {
    const expected = process.env.MIGRATION_SECRET;
    if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const declared = Number(request.headers.get("content-length") || "0");
    if (declared > MAX_REQUEST_BYTES) return new Response("Payload too large", { status: 413 });
    const text = await readBoundedRequest(request);
    if (text === null) return new Response("Payload too large", { status: 413 });
    try {
      const args = JSON.parse(text);
      const result = await ctx.runMutation(importBatchReference, args);
      return Response.json(result);
    } catch (error) {
      console.error("Migration import failed", error);
      return Response.json({ status: "error", message: "Migration import failed" }, { status: 409 });
    }
  }),
});

http.route({
  path: "/migration/clear-owner",
  method: "POST",
  handler: httpActionGeneric(async (ctx, request) => {
    const expected = process.env.MIGRATION_SECRET;
    if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const declared = Number(request.headers.get("content-length") || "0");
    if (declared > 16_384) return new Response("Payload too large", { status: 413 });
    const text = await readBoundedRequest(request);
    if (text === null || new TextEncoder().encode(text).byteLength > 16_384) {
      return new Response("Payload too large", { status: 413 });
    }
    try {
      const result = await ctx.runMutation(clearOwnerGraphReference, JSON.parse(text));
      return Response.json(result);
    } catch (error) {
      console.error("Migration reset failed", error);
      return Response.json({ status: "error", message: "Migration reset failed" }, { status: 409 });
    }
  }),
});

export default http;
