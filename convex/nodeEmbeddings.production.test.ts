import { describe, expect, test } from "vitest";

import { validateEmbeddingVector } from "./nodeEmbeddings";

const vector = (value: number) => Array.from({ length: 1536 }, () => value);

describe("NodeAgent OpenAI embedding boundary", () => {
  test("a production embedding is accepted only at the locked finite shape", () => {
    expect(validateEmbeddingVector(vector(0.2))[0]).toBe(0.2);
  });

  test("a malformed or truncated provider vector fails closed", () => {
    expect(() => validateEmbeddingVector([0.1])).toThrow("INVALID_EMBEDDING_VECTOR");
    expect(() => validateEmbeddingVector([...vector(0.1).slice(0, -1), Number.NaN]))
      .toThrow("INVALID_EMBEDDING_VECTOR");
  });
});
