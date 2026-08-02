export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const OPENAI_EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_STORE_CHUNK_SIZE = 4;

export function buildEmbeddingWrites<T extends { sourceId: string; version: number }>(
  work: T[],
  embeddings: number[][],
) {
  if (work.length !== embeddings.length) throw new Error("embedding_write_count_mismatch");
  return work.map((item, index) => ({
    sourceId: item.sourceId,
    version: item.version,
    embedding: embeddings[index],
  }));
}

export function chunkEmbeddingWrites<T>(items: T[]) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += EMBEDDING_STORE_CHUNK_SIZE) {
    chunks.push(items.slice(index, index + EMBEDDING_STORE_CHUNK_SIZE));
  }
  return chunks;
}

export function parseEmbeddingResponse(body: unknown, expectedCount: number) {
  const rows = Array.isArray((body as { data?: unknown[] })?.data)
    ? (body as { data: Array<{ index?: unknown; embedding?: unknown }> }).data
    : [];
  const embeddings = rows
    .filter((row) => Number.isInteger(row?.index) && Array.isArray(row?.embedding))
    .sort((left, right) => Number(left.index) - Number(right.index))
    .map((row) => row.embedding as number[]);
  if (embeddings.length !== expectedCount) throw new Error("embedding_count_mismatch");
  for (const embedding of embeddings) {
    if (embedding.length !== OPENAI_EMBEDDING_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) {
      throw new Error("embedding_shape_mismatch");
    }
  }
  return embeddings;
}
