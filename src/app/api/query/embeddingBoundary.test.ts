import {
  chunkEmbeddingWrites,
  EMBEDDING_STORE_CHUNK_SIZE,
  OPENAI_EMBEDDING_DIMENSIONS,
  parseEmbeddingResponse,
} from "./embeddingBoundary";

describe("NodeBook embedding boundaries", () => {
  test("a large notebook hydration is split into transaction-safe deterministic writes", () => {
    const items = Array.from({ length: 24 }, (_, index) => ({
      sourceId: `note-${index}`,
      version: 1,
      contentText: `Note ${index}`,
      embedding: Array.from({ length: OPENAI_EMBEDDING_DIMENSIONS }, () => 0.123456789),
    }));

    const chunks = chunkEmbeddingWrites(items);

    expect(chunks).toHaveLength(6);
    expect(chunks.every((chunk) => chunk.length <= EMBEDDING_STORE_CHUNK_SIZE)).toBe(true);
    expect(chunks.flat().map((item) => item.sourceId)).toEqual(items.map((item) => item.sourceId));
    expect(Math.max(...chunks.map((chunk) => Buffer.byteLength(JSON.stringify({ items: chunk }), "utf8")))).toBeLessThan(256_000);
  });

  test("a malformed provider vector is rejected before any notebook write", () => {
    expect(() => parseEmbeddingResponse({ data: [{ index: 0, embedding: [0.1] }] }, 1)).toThrow("embedding_shape_mismatch");
  });
});
