import { executeReadOnlyAgent } from "./agent";

const NOW = new Date("2026-07-30T12:00:00.000Z");

describe("NodeBook read-only agent scenarios", () => {
  test("an authenticated research user gets evidence provenance and a durable receipt", async () => {
    const recordRun = jest.fn().mockResolvedValue("receipt-id");
    const result = await executeReadOnlyAgent("What supports the launch?", "gpt-5-mini", {
      searchContext: async () => [
        JSON.stringify({ id: "node-2", content: [{ type: "text", value: "Interview evidence" }] }),
        JSON.stringify({ id: "node-1", content: [{ type: "text", value: "Launch plan" }] }),
      ],
      runProvider: async () => ({
        content: "Two notes directly support the launch.",
        usage: { inputTokens: 120, outputTokens: 12, totalTokens: 132 },
      }),
      recordRun,
      now: () => NOW,
      runId: () => "run-happy",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "completed",
        content: "Two notes directly support the launch.",
        receipt: expect.objectContaining({
          runId: "run-happy",
          sourceNodeIds: ["node-2", "node-1"],
          persisted: true,
          usage: { inputTokens: 120, outputTokens: 12, totalTokens: 132 },
        }),
      }),
    );
    expect(recordRun).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", mode: "read-only" }));
  });

  test("a degraded receipt store never pretends the successful answer was durably recorded", async () => {
    const result = await executeReadOnlyAgent("Summarize evidence", "gpt-5-mini", {
      searchContext: async () => [],
      runProvider: async () => ({
        content: "The graph context is insufficient.",
        usage: { inputTokens: null, outputTokens: null, totalTokens: null },
      }),
      recordRun: async () => {
        throw new Error("Convex unavailable");
      },
      now: () => NOW,
      runId: () => "run-degraded",
    });

    expect(result.receipt.persisted).toBe(false);
    expect(result.receipt.usage.totalTokens).toBeNull();
  });

  test("a provider outage records a failed run and returns no fabricated answer", async () => {
    const recordRun = jest.fn().mockResolvedValue("receipt-id");
    await expect(
      executeReadOnlyAgent("Summarize evidence", "gpt-5-mini", {
        searchContext: async () => [JSON.stringify({ id: "node-1", content: "Evidence" })],
        runProvider: async () => {
          throw new Error("provider timeout");
        },
        recordRun,
        now: () => NOW,
        runId: () => "run-failed",
      }),
    ).rejects.toThrow("provider timeout");
    expect(recordRun).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", error: "provider timeout" }));
  });

  test("a burst of malformed legacy documents remains bounded and does not poison valid evidence", async () => {
    const documents = Array.from({ length: 1_000 }, (_, index) =>
      index === 0 ? JSON.stringify({ id: "valid-node", content: "Evidence" }) : "{malformed",
    );
    const runProvider = jest.fn().mockResolvedValue({
      content: "One valid evidence node.",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
    const result = await executeReadOnlyAgent("Find evidence", "gpt-5-mini", {
      searchContext: async () => documents,
      runProvider,
      recordRun: async () => undefined,
      now: () => NOW,
      runId: () => "run-burst",
    });

    expect(result.receipt.sourceNodeIds).toEqual(["valid-node"]);
    expect(runProvider.mock.calls[0][0].context.length).toBeLessThanOrEqual(80_000);
  });
});
