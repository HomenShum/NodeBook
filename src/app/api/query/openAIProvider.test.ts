import { parseEmbeddingResponse } from "./embeddingBoundary";

const vector = (value: number) => Array.from({ length: 1536 }, () => value);

describe("NodeAgent embedding provider boundary", () => {
  test("a shuffled provider response is restored to the original input order", () => {
    const parsed = parseEmbeddingResponse({ data: [
      { index: 1, embedding: vector(0.2) },
      { index: 0, embedding: vector(0.1) },
    ] }, 2);
    expect(parsed[0][0]).toBe(0.1);
    expect(parsed[1][0]).toBe(0.2);
  });

  test("a truncated or non-finite provider response fails closed", () => {
    expect(() => parseEmbeddingResponse({ data: [{ index: 0, embedding: [0.1] }] }, 1))
      .toThrow("embedding_shape_mismatch");
    expect(() => parseEmbeddingResponse({ data: [{ index: 0, embedding: [...vector(0.1).slice(0, -1), Number.NaN] }] }, 1))
      .toThrow("embedding_shape_mismatch");
    expect(() => parseEmbeddingResponse({ data: [] }, 1)).toThrow("embedding_count_mismatch");
  });
});
