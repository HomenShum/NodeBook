import { z } from "zod";

import { digest } from "./workflowAgent";

const MAX_JOURNAL_RESPONSE_BYTES = 512 * 1024;

// Timed exponential backoff for transient provider failures. Timeouts are
// deliberately excluded: the route-level deadline already spent the budget, and
// replaying a 110s wait would blow past PROVIDER_DEADLINE_MS.
export const PROVIDER_RETRY = Object.freeze({ maxAttempts: 3, baseDelayMs: 1_000, factor: 2, maxDelayMs: 30_000 });

export function transientRetryDelayMs(attempt: number) {
  return Math.min(PROVIDER_RETRY.baseDelayMs * PROVIDER_RETRY.factor ** (attempt - 1), PROVIDER_RETRY.maxDelayMs);
}

export function isTransientProviderFailure(error: unknown) {
  if (!(error instanceof Error)) return false;
  // Provider rejections carry "(status:code)" from runOpenAI; 408/429/5xx are transient.
  return /\((?:408|429|5\d\d):/.test(error.message) || error.message.includes("fetch failed");
}

export async function retryTransientProvider<T>(
  run: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= PROVIDER_RETRY.maxAttempts || !isTransientProviderFailure(error)) throw error;
      await sleep(transientRetryDelayMs(attempt));
    }
  }
}

const JournaledProviderResponseSchema = z.object({
  result: z.unknown(),
  sources: z.array(z.string().max(2_048)).max(20),
  usage: z.object({
    inputTokens: z.number().nonnegative().nullable(),
    outputTokens: z.number().nonnegative().nullable(),
    totalTokens: z.number().nonnegative().nullable(),
  }),
  actualModel: z.string().min(1).max(200),
});
export type JournaledProviderResponse = {
  result: unknown;
  sources: string[];
  usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
  actualModel: string;
};

export type JournaledProviderInput = {
  input: string;
  instructions: string;
  model: string;
  webResearch: boolean;
  timeoutMs: number;
  outputSchema?: Record<string, unknown>;
  outputName?: string;
  maxOutputTokens?: number;
  provider: "openai" | "openrouter";
  fallbackModels?: string[];
};

function parseResponse(responseJson: string) {
  if (Buffer.byteLength(responseJson, "utf8") > MAX_JOURNAL_RESPONSE_BYTES) throw new Error("Journaled provider response exceeded the size limit");
  return JournaledProviderResponseSchema.parse(JSON.parse(responseJson)) as JournaledProviderResponse;
}

export function providerJournalIdentity(args: JournaledProviderInput) {
  const inputDigest = digest({
    input: args.input,
    instructions: args.instructions,
    model: args.model,
    webResearch: args.webResearch,
    outputSchema: args.outputSchema ?? null,
    outputName: args.outputName ?? null,
    maxOutputTokens: args.maxOutputTokens ?? 2_500,
    provider: args.provider,
    fallbackModels: args.fallbackModels?.slice(0, 3) ?? [],
  });
  return { inputDigest, stepKey: inputDigest };
}

export async function runJournaledProvider(args: {
  traceId: string;
  providerInput: JournaledProviderInput;
  read: (identity: { traceId: string; stepKey: string; inputDigest: string }) => Promise<{ responseJson: string } | null>;
  claim: (entry: {
    traceId: string;
    stepKey: string;
    inputDigest: string;
    provider: "openai" | "openrouter";
    model: string;
    nowMs: number;
    leaseMs: number;
  }) => Promise<{ status: "claimed" | "in_progress" | "replayed"; responseJson?: string }>;
  run: () => Promise<JournaledProviderResponse>;
  record: (entry: {
    traceId: string;
    stepKey: string;
    inputDigest: string;
    outputDigest: string;
    provider: "openai" | "openrouter";
    model: string;
    responseJson: string;
    createdAtMs: number;
  }) => Promise<{ responseJson: string }>;
  release: (identity: { traceId: string; stepKey: string; inputDigest: string }) => Promise<unknown>;
  sleep?: (ms: number) => Promise<void>;
}) {
  const identity = { traceId: args.traceId, ...providerJournalIdentity(args.providerInput) };
  const replay = await args.read(identity);
  if (replay) return parseResponse(replay.responseJson);

  const claim = await args.claim({
    ...identity,
    provider: args.providerInput.provider,
    model: args.providerInput.model,
    nowMs: Date.now(),
    leaseMs: Math.min(Math.max(args.providerInput.timeoutMs + 5_000, 1_000), 120_000),
  });
  if (claim.status === "replayed" && claim.responseJson) return parseResponse(claim.responseJson);
  if (claim.status === "in_progress") throw new Error("JOURNAL_STEP_IN_PROGRESS");

  try {
    const fresh = JournaledProviderResponseSchema.parse(await retryTransientProvider(args.run, args.sleep)) as JournaledProviderResponse;
    const responseJson = JSON.stringify(fresh);
    if (Buffer.byteLength(responseJson, "utf8") > MAX_JOURNAL_RESPONSE_BYTES) throw new Error("Journaled provider response exceeded the size limit");
    const canonical = await args.record({
      ...identity,
      outputDigest: digest(fresh),
      provider: args.providerInput.provider,
      model: fresh.actualModel,
      responseJson,
      createdAtMs: Date.now(),
    });
    return parseResponse(canonical.responseJson);
  } catch (error) {
    try { await args.release(identity); } catch { /* Preserve the provider failure; the lease remains bounded. */ }
    throw error;
  }
}
