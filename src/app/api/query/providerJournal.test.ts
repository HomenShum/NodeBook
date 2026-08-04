import {
  PROVIDER_RETRY,
  providerJournalIdentity,
  runJournaledProvider,
  transientRetryDelayMs,
  type JournaledProviderInput,
} from "./providerJournal";

const providerInput: JournaledProviderInput = {
  input: "Organize the launch notes",
  instructions: "Return a bounded plan",
  model: "gpt-test",
  webResearch: false,
  timeoutMs: 10_000,
  provider: "openai",
  outputSchema: { type: "object", properties: { answer: { type: "string" } } },
};
const response = {
  result: { answer: "Done" },
  sources: [],
  usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
  actualModel: "gpt-test",
};

describe("NodeAgent provider step journal", () => {
  test("a retried trace replays the completed provider result without a second billable call", async () => {
    const run = jest.fn(async () => response);
    const record = jest.fn();
    const replayed = await runJournaledProvider({
      traceId: "trace-retry",
      providerInput,
      read: async () => ({ responseJson: JSON.stringify(response) }),
      claim: async () => ({ status: "claimed" }),
      run,
      record,
      release: async () => undefined,
    });

    expect(replayed).toEqual(response);
    expect(run).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  test("a concurrent first-writer receipt becomes canonical even if another model call differed", async () => {
    const canonical = { ...response, result: { answer: "Canonical" } };
    const observed = await runJournaledProvider({
      traceId: "trace-race",
      providerInput,
      read: async () => null,
      claim: async () => ({ status: "claimed" }),
      run: async () => response,
      record: async () => ({ responseJson: JSON.stringify(canonical) }),
      release: async () => undefined,
    });

    expect(observed).toEqual(canonical);
  });

  test("equivalent structured inputs produce one deterministic step key", () => {
    const reordered = { ...providerInput, outputSchema: { properties: { answer: { type: "string" } }, type: "object" } };
    expect(providerJournalIdentity(reordered)).toEqual(providerJournalIdentity(providerInput));
  });

  test("a simultaneous retry stops at the durable lease before calling the provider", async () => {
    const run = jest.fn(async () => response);
    await expect(runJournaledProvider({
      traceId: "trace-leased",
      providerInput,
      read: async () => null,
      claim: async () => ({ status: "in_progress" }),
      run,
      record: async () => ({ responseJson: JSON.stringify(response) }),
      release: async () => undefined,
    })).rejects.toThrow("JOURNAL_STEP_IN_PROGRESS");
    expect(run).not.toHaveBeenCalled();
  });

  test("a provider that fails twice transiently succeeds on the third attempt with increasing backoff delays", async () => {
    const observedDelays: number[] = [];
    let calls = 0;
    const run = jest.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error(`AI provider rejected the run (503:server_overloaded): try again`);
      return response;
    });
    const record = jest.fn(async () => ({ responseJson: JSON.stringify(response) }));
    const observed = await runJournaledProvider({
      traceId: "trace-backoff",
      providerInput,
      read: async () => null,
      claim: async () => ({ status: "claimed" }),
      run,
      record,
      release: async () => undefined,
      sleep: async (ms) => { observedDelays.push(ms); },
    });

    expect(observed).toEqual(response);
    expect(run).toHaveBeenCalledTimes(3);
    expect(record).toHaveBeenCalledTimes(1);
    expect(observedDelays).toEqual([1_000, 2_000]);
    expect(observedDelays[1]).toBeGreaterThan(observedDelays[0]);
  });

  test("a non-transient provider rejection is not retried", async () => {
    const run = jest.fn(async () => { throw new Error("AI provider rejected the run (400:invalid_request): bad schema"); });
    const release = jest.fn(async () => undefined);
    await expect(runJournaledProvider({
      traceId: "trace-no-retry",
      providerInput,
      read: async () => null,
      claim: async () => ({ status: "claimed" }),
      run,
      record: async () => ({ responseJson: JSON.stringify(response) }),
      release,
      sleep: async () => { throw new Error("backoff must not run for permanent failures"); },
    })).rejects.toThrow("(400:invalid_request)");
    expect(run).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("the backoff schedule grows exponentially from the base and stays under the cap", () => {
    expect(PROVIDER_RETRY.maxDelayMs).toBeGreaterThanOrEqual(PROVIDER_RETRY.baseDelayMs);
    expect(transientRetryDelayMs(1)).toBe(PROVIDER_RETRY.baseDelayMs);
    expect(transientRetryDelayMs(2)).toBe(PROVIDER_RETRY.baseDelayMs * PROVIDER_RETRY.factor);
    expect(transientRetryDelayMs(20)).toBe(PROVIDER_RETRY.maxDelayMs);
  });
});
