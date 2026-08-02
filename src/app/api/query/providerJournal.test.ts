import { providerJournalIdentity, runJournaledProvider, type JournaledProviderInput } from "./providerJournal";

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
      run,
      record,
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
      run: async () => response,
      record: async () => ({ responseJson: JSON.stringify(canonical) }),
    });

    expect(observed).toEqual(canonical);
  });

  test("equivalent structured inputs produce one deterministic step key", () => {
    const reordered = { ...providerInput, outputSchema: { properties: { answer: { type: "string" } }, type: "object" } };
    expect(providerJournalIdentity(reordered)).toEqual(providerJournalIdentity(providerInput));
  });
});
