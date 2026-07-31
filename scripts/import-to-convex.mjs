import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const MAX_BATCH_ROWS = 50;
const MAX_BATCH_BYTES = 700 * 1024;
const MAX_MULTI_ROW_REQUEST_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_INLINE_NODE_BYTES = 700 * 1024;
const NODE_CHUNK_CHARACTERS = 100_000;
const TABLES = ["users", "nodes", "relations", "relationTypes", "relationLists", "nodeChunks"];
const derivedNodeChunks = [];

function validatedSiteUrl(value) {
  const url = new URL(value);
  const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    throw new Error("CONVEX_SITE_URL must use HTTPS unless it targets localhost");
  }
  if (url.username || url.password) throw new Error("CONVEX_SITE_URL must not contain credentials");
  return url.origin;
}

async function readBoundedResponse(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Migration response exceeded 1 MiB");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalize(value, sourceNamespace, targetNamespace) {
  if (typeof value === "string" && sourceNamespace) return value.split(sourceNamespace).join(targetNamespace);
  if (Array.isArray(value)) return value.map((item) => normalize(item, sourceNamespace, targetNamespace));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, sourceNamespace, targetNamespace)]));
  }
  return value;
}

function migrationRow(table, raw, frozenAt) {
  const stableUpdatedAt = raw.updatedAt || raw.createdAt || frozenAt;
  if (table === "users") {
    return {
      ownerId: raw.id,
      document: JSON.stringify(raw),
      updatedAt: stableUpdatedAt,
    };
  }
  if (table === "relationLists") {
    const sourceId = `${raw.nodeId}\u001f${raw.relationId}\u001f${raw.type}`;
    return {
      ownerId: raw.authorId,
      sourceId,
      nodeId: raw.nodeId,
      relationId: raw.relationId,
      type: raw.type,
      isPublic: raw.isPublic === true,
      document: JSON.stringify({
        operation: "updateRelationList",
        authorId: raw.authorId,
        nodeId: raw.nodeId,
        relationId: raw.relationId,
        type: raw.type,
        newPosition: { int: Number(raw.positionInt || 0), frac: raw.positionFrac || "" },
        newIsPublic: raw.isPublic === true,
      }),
      updatedAt: stableUpdatedAt,
    };
  }
  if (table === "nodes") {
    const document = JSON.stringify(raw);
    if (new TextEncoder().encode(document).byteLength > MAX_INLINE_NODE_BYTES) {
      const chunks = [];
      for (let offset = 0; offset < document.length; offset += NODE_CHUNK_CHARACTERS) {
        chunks.push(document.slice(offset, offset + NODE_CHUNK_CHARACTERS));
      }
      const documentDigest = createHash("sha256").update(document).digest("hex");
      chunks.forEach((chunk, chunkIndex) => {
        derivedNodeChunks.push({
          ownerId: raw.authorId,
          sourceId: `${raw.id}\u001f${chunkIndex}`,
          nodeId: raw.id,
          chunkIndex,
          document: chunk,
          updatedAt: stableUpdatedAt,
        });
      });
      const contentText = Array.isArray(raw.content)
        ? raw.content
            .map((part) => (part && typeof part === "object" && typeof part.value === "string" ? part.value : ""))
            .join(" ")
            .slice(0, 32_768)
        : "";
      return {
        ownerId: raw.authorId,
        sourceId: raw.id,
        version: Number(raw.version || 1),
        isPublic: raw.isPublic === true,
        document: JSON.stringify({
          __nodebookChunked: true,
          chunkCount: chunks.length,
          documentDigest,
          id: raw.id,
          authorId: raw.authorId,
          version: Number(raw.version || 1),
          isPublic: raw.isPublic === true,
          slug: raw.slug ?? null,
        }),
        contentText,
        updatedAt: stableUpdatedAt,
      };
    }
  }
  return {
    ownerId: raw.authorId,
    sourceId: raw.id,
    version: Number(raw.version || 1),
    isPublic: raw.isPublic === true,
    document: JSON.stringify(raw),
    updatedAt: stableUpdatedAt,
  };
}

async function postBatch(siteUrl, secret, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Migration request timed out"), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("/migration/import", validatedSiteUrl(siteUrl)), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await readBoundedResponse(response);
    if (!response.ok) throw new Error(`Migration batch failed with HTTP ${response.status}: ${text}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

const [inputArg, receiptArg = "nodebook-migration-receipt.json"] = process.argv.slice(2);
if (!inputArg) throw new Error("Usage: node scripts/import-to-convex.mjs <export.json> [receipt.json]");
const siteUrl = process.env.CONVEX_SITE_URL;
const secret = process.env.MIGRATION_SECRET;
if (!siteUrl || !secret) throw new Error("CONVEX_SITE_URL and MIGRATION_SECRET are required");
const sourceNamespace = process.env.SOURCE_NAMESPACE || "";
const targetNamespace = process.env.TARGET_NAMESPACE || "nodebook";
const input = JSON.parse(await readFile(resolve(inputArg), "utf8"));
const sourceKey = String(input.sourceKey || createHash("sha256").update(canonical(input)).digest("hex"));
const frozenAt = String(input.frozenAt || "1970-01-01T00:00:00.000Z");
const receipt = { contract: "nodebook.migration-receipt/v1", sourceKey, tables: {}, completedAt: null };

for (const table of TABLES) {
  const normalized =
    table === "nodeChunks" ? derivedNodeChunks : normalize(input.tables?.[table] || [], sourceNamespace, targetNamespace);
  const rows = table === "nodeChunks" ? normalized : normalized.map((row) => migrationRow(table, row, frozenAt));
  let imported = 0;
  let batches = 0;
  let replayedBatches = 0;
  for (let index = 0; index < rows.length;) {
    let batch = rows.slice(index, index + MAX_BATCH_ROWS);
    while (batch.length > 1 && new TextEncoder().encode(JSON.stringify(batch)).byteLength > MAX_BATCH_BYTES) batch = batch.slice(0, -1);
    let rowsJson = JSON.stringify(batch);
    if (new TextEncoder().encode(rowsJson).byteLength > MAX_BATCH_BYTES) throw new Error(`${table} contains an oversized row`);
    let digest = createHash("sha256").update(rowsJson).digest("hex");
    let requestBody = { sourceKey, batchKey: `${table}:${index}`, digest, table, rowsJson };
    while (
      batch.length > 1 &&
      new TextEncoder().encode(JSON.stringify(requestBody)).byteLength > MAX_MULTI_ROW_REQUEST_BYTES
    ) {
      batch = batch.slice(0, -1);
      rowsJson = JSON.stringify(batch);
      digest = createHash("sha256").update(rowsJson).digest("hex");
      requestBody = { sourceKey, batchKey: `${table}:${index}`, digest, table, rowsJson };
    }
    if (new TextEncoder().encode(JSON.stringify(requestBody)).byteLength > MAX_REQUEST_BYTES) {
      throw new Error(`${table} contains a row whose encoded request exceeds 4 MiB`);
    }
    let result;
    try {
      result = await postBatch(siteUrl, secret, requestBody);
    } catch (error) {
      throw new Error(`${table} batch starting at row ${index} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    imported += result.imported;
    batches += 1;
    if (result.replayed === true) replayedBatches += 1;
    index += batch.length;
  }
  receipt.tables[table] = {
    sourceCount: rows.length,
    importedCount: imported,
    batches,
    replayedBatches,
    digest: createHash("sha256").update(canonical(rows)).digest("hex"),
  };
}
receipt.completedAt = new Date().toISOString();
await writeFile(resolve(receiptArg), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify(receipt, null, 2));
