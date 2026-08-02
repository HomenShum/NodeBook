import { describe, expect, test } from "vitest";

import { parseEmbeddingResponse } from "./nodeEmbeddings";

const vector = (value: number) => Array.from({ length: 1536 }, () => value);

describe("NodeAgent OpenAI embedding boundary", () => {
  test("a shuffled provider response is restored to input order only when every vector has the locked shape", () => {
    const parsed = parseEmbeddingResponse({ data: [
      { index: 1, embedding: vector(0.2) },
      { index: 0, embedding: vector(0.1) },
    ] }, 2);
    expect(parsed[0][0]).toBe(0.1);
    expect(parsed[1][0]).toBe(0.2);
  });

  test("a malformed or truncated provider vector fails closed", () => {
    expect(() => parseEmbeddingResponse({ data: [{ index: 0, embedding: [0.1] }] }, 1))
      .toThrow("embedding_shape_mismatch");
    expect(() => parseEmbeddingResponse({ data: [] }, 1)).toThrow("embedding_count_mismatch");
  });
});
