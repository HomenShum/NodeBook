import { ConvexError } from "convex/values";

type NodeRow = { ownerId: string; sourceId: string; document: string };
type QueryContext = { db: any };
type ChunkMarker = { __nodebookChunked: true; chunkCount: number; documentDigest: string };

function chunkMarker(document: string): ChunkMarker | null {
  try {
    const parsed = JSON.parse(document) as Partial<ChunkMarker>;
    return parsed.__nodebookChunked === true &&
      Number.isSafeInteger(parsed.chunkCount) &&
      (parsed.chunkCount ?? 0) > 0 &&
      typeof parsed.documentDigest === "string"
      ? (parsed as ChunkMarker)
      : null;
  } catch {
    return null;
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hydrateNodeDocument(ctx: QueryContext, node: NodeRow) {
  const marker = chunkMarker(node.document);
  if (!marker) return node.document;
  const chunks = await ctx.db
    .query("nodeChunks")
    .withIndex("by_owner_node", (q: any) => q.eq("ownerId", node.ownerId).eq("nodeId", node.sourceId))
    .collect();
  chunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
  if (chunks.length !== marker.chunkCount) {
    throw new ConvexError({ code: "NODE_CHUNKS_MISSING", message: "chunked node is incomplete" });
  }
  const document = chunks.map((chunk: any) => chunk.document).join("");
  if ((await sha256(document)) !== marker.documentDigest) {
    throw new ConvexError({ code: "NODE_CHUNKS_CORRUPT", message: "chunked node digest mismatch" });
  }
  return document;
}
