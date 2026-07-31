import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { UNLOGGED_USER } from "@/app/auth/NodeBookUser";
import {
  beginChunkedNodeUpdateReference,
  finalizeChunkedNodeUpdateReference,
  getBearerToken,
  getConvexClient,
  uploadChunkedNodePartReference,
} from "@/lib/convexServer";

const MAX_REQUEST_BYTES = 384 * 1024;
const DigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const RequestSchema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("start"),
    uploadId: z.string().min(1).max(2_048),
    transactionId: z.string().min(1).max(2_048),
    clientId: z.string().min(1).max(2_048),
    nodeId: z.string().min(1).max(2_048),
    expectedVersion: z.number().int().positive(),
    targetVersion: z.number().int().positive(),
    oldEntityHash: DigestSchema,
    newDocumentDigest: DigestSchema,
    chunkCount: z.number().int().min(1).max(64),
    totalBytes: z.number().int().min(1).max(4 * 1024 * 1024),
    metadataHash: DigestSchema,
  }),
  z.object({
    phase: z.literal("part"),
    uploadId: z.string().min(1).max(2_048),
    chunkIndex: z.number().int().min(0).max(63),
    document: z.string().min(1).max(128 * 1024),
    digest: DigestSchema,
  }),
  z.object({
    phase: z.literal("finalize"),
    uploadId: z.string().min(1).max(2_048),
  }),
]);

async function readBoundedJson(request: Request) {
  if (!request.body) throw new Error("EMPTY_REQUEST");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Error("REQUEST_TOO_LARGE");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally {
    reader.releaseLock();
  }
}

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  if (request.userId === UNLOGGED_USER.id) {
    return NextResponse.json({ status: "error", message: "Authentication is required" }, { status: 401 });
  }
  let input: unknown;
  try {
    input = await readBoundedJson(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "REQUEST_TOO_LARGE";
    return NextResponse.json(
      { status: "error", message: tooLarge ? "Chunked node request is too large" : "Invalid JSON body" },
      { status: tooLarge ? 413 : 400 },
    );
  }
  const parsed = RequestSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid chunked node request" }, { status: 400 });
  }
  try {
    const client = getConvexClient(getBearerToken(request));
    const { phase, ...args } = parsed.data;
    const result = phase === "start"
      ? await client.mutation(beginChunkedNodeUpdateReference, args)
      : phase === "part"
        ? await client.mutation(uploadChunkedNodePartReference, args)
        : await client.mutation(finalizeChunkedNodeUpdateReference, args);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chunked node sync failed", error);
    const timedOut = error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("timed out"));
    return NextResponse.json(
      { status: "error", message: timedOut ? "Chunked node sync timed out" : "Chunked node sync conflict" },
      { status: timedOut ? 504 : 409 },
    );
  }
});
