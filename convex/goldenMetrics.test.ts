import { computeGoldenMetrics, nearestRankPercentile } from "./goldenMetrics";

describe("golden metrics computed from persisted run receipts", () => {
  test("the three exact-named metrics come out of synthetic run records", () => {
    // 10 runs: 8 reached a terminal result, 2 failed outright.
    const runStatuses = [
      "completed", "completed", "completed", "applied", "proposed",
      "rejected", "undone", "completed", "failed", "failed",
    ];
    // 20 tool calls: 3 errored, 1 repaired (recovered, not an error).
    const stepStatuses = [
      ...Array(16).fill("completed"),
      "failed", "failed", "failed", "repaired",
    ];
    // 100 latencies 10..1000ms: nearest-rank p99 of a 100-sample set is the
    // 99th sorted value, 990ms.
    const latenciesMs = Array.from({ length: 100 }, (_, index) => (index + 1) * 10);

    const metrics = computeGoldenMetrics({ runStatuses, stepStatuses, latenciesMs });

    expect(metrics["task-completion-rate"]).toBe(0.8);
    expect(metrics["tool-call-error-rate"]).toBe(0.15);
    expect(metrics["p99-latency-ms"]).toBe(990);
    expect(metrics.sampleSizes).toEqual({ runs: 10, toolCalls: 20, latencies: 100 });
  });

  test("no data yields null metrics, never a fabricated zero", () => {
    const metrics = computeGoldenMetrics({ runStatuses: [], stepStatuses: [], latenciesMs: [] });
    expect(metrics["task-completion-rate"]).toBeNull();
    expect(metrics["tool-call-error-rate"]).toBeNull();
    expect(metrics["p99-latency-ms"]).toBeNull();
  });

  test("nearest-rank percentile is exact on small samples", () => {
    expect(nearestRankPercentile([500], 99)).toBe(500);
    expect(nearestRankPercentile([300, 100, 200], 50)).toBe(200);
    expect(nearestRankPercentile([300, 100, 200], 99)).toBe(300);
  });
});
