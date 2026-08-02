import { describe, expect, test } from "vitest";

import { clusterKnowledgeMapRows, validateEmbeddingVector } from "./nodeEmbeddings";

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

  test("a founder with two recurring topic families gets deterministic semantic clusters", () => {
    const rows = [
      { sourceId: "customer-a", contentText: "Customer interviews retention feedback", embedding: [0, 0] },
      { sourceId: "customer-b", contentText: "Customer research onboarding feedback", embedding: [0.1, 0.2] },
      { sourceId: "customer-c", contentText: "Customer discovery interview notes", embedding: [0.2, 0.1] },
      { sourceId: "model-a", contentText: "Model evaluation benchmark latency", embedding: [10, 10] },
      { sourceId: "model-b", contentText: "Model routing benchmark quality", embedding: [10.2, 10.1] },
      { sourceId: "model-c", contentText: "Model inference latency evaluation", embedding: [9.9, 10.1] },
    ];

    const first = clusterKnowledgeMapRows(rows, 2);
    const second = clusterKnowledgeMapRows([...rows].reverse(), 2);

    expect(first).toEqual(second);
    expect(first.map((cluster) => cluster.nodeIds)).toEqual([
      ["customer-a", "customer-b", "customer-c"],
      ["model-a", "model-b", "model-c"],
    ]);
    expect(first.map((cluster) => cluster.title)).toEqual(["Customer · Feedback · Discovery", "Model · Benchmark · Evaluation"]);
  });

  test("a noisy notebook cannot expand a knowledge-map run beyond twelve notes and five clusters", () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      sourceId: `note-${index.toString().padStart(2, "0")}`,
      contentText: `Topic ${index % 7} evidence ${index}`,
      embedding: [index % 7, index / 100],
    }));
    const clusters = clusterKnowledgeMapRows(rows, 99);

    expect(clusters).toHaveLength(5);
    expect(clusters.flatMap((cluster) => cluster.nodeIds)).toHaveLength(12);
    expect(new Set(clusters.flatMap((cluster) => cluster.nodeIds)).size).toBe(12);
  });

  test("malformed mixed-dimension cluster input fails closed without a partial map", () => {
    expect(clusterKnowledgeMapRows([
      { sourceId: "a", contentText: "A", embedding: [0, 0] },
      { sourceId: "b", contentText: "B", embedding: [1, 1] },
      { sourceId: "c", contentText: "C", embedding: [2, 2] },
      { sourceId: "d", contentText: "D", embedding: [3] },
    ], 2)).toEqual([]);
  });
});
