import { z } from "zod";

import { digest } from "./workflowAgent";

const MAX_JOURNAL_RESPONSE_BYTES = 512 * 1024;

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
}) {
  const identity = { traceId: args.traceId, ...providerJournalIdentity(args.providerInput) };
  const replay = await args.read(identity);
  if (replay) return parseResponse(replay.responseJson);

  const fresh = JournaledProviderResponseSchema.parse(await args.run()) as JournaledProviderResponse;
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
}
