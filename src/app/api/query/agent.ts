import { randomUUID } from "crypto";

export type AgentUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type AgentReceipt = {
  runId: string;
  status: "completed" | "failed";
  provider: "openai";
  model: string;
  mode: "read-only";
  startedAt: string;
  completedAt: string;
  sourceNodeIds: string[];
  usage: AgentUsage;
  persisted: boolean;
};

export type AgentResult = {
  status: "completed";
  content: string;
  receipt: AgentReceipt;
};

type ContextNode = { id: string; content: unknown };

export type AgentDependencies = {
  searchContext: (query: string) => Promise<string[]>;
  runProvider: (args: { query: string; context: string; model: string }) => Promise<{ content: string; usage: AgentUsage }>;
  recordRun: (record: {
    runId: string;
    status: "completed" | "failed";
    provider: "openai";
    model: string;
    mode: "read-only";
    query: string;
    sourceNodeIds: string[];
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    error?: string;
    startedAt: string;
    completedAt: string;
    startedAtMs: number;
  }) => Promise<unknown>;
  now?: () => Date;
  runId?: () => string;
};

function parseContext(documents: string[]) {
  const nodes: ContextNode[] = [];
  for (const document of documents.slice(0, 20)) {
    try {
      const parsed = JSON.parse(document) as Record<string, unknown>;
      const id = typeof parsed.id === "string" ? parsed.id : typeof parsed.clientId === "string" ? parsed.clientId : null;
      if (id) nodes.push({ id, content: parsed.content });
    } catch {
      // A malformed legacy document must not crash an otherwise valid read-only run.
    }
  }
  return nodes;
}

export async function executeReadOnlyAgent(query: string, model: string, dependencies: AgentDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const runId = (dependencies.runId ?? randomUUID)();
  const started = now();
  const startedAt = started.toISOString();
  const documents = query.length >= 3 ? await dependencies.searchContext(query) : [];
  const nodes = parseContext(documents);
  const sourceNodeIds = nodes.map((node) => node.id);
  const context = nodes.map((node) => JSON.stringify(node)).join("\n").slice(0, 80_000);

  try {
    const provider = await dependencies.runProvider({ query, context, model });
    const completedAt = now().toISOString();
    let persisted = true;
    try {
      await dependencies.recordRun({
        runId,
        status: "completed",
        provider: "openai",
        model,
        mode: "read-only",
        query,
        sourceNodeIds,
        inputTokens: provider.usage.inputTokens,
        outputTokens: provider.usage.outputTokens,
        totalTokens: provider.usage.totalTokens,
        startedAt,
        completedAt,
        startedAtMs: started.getTime(),
      });
    } catch {
      persisted = false;
    }
    return {
      status: "completed",
      content: provider.content,
      receipt: {
        runId,
        status: "completed",
        provider: "openai",
        model,
        mode: "read-only",
        startedAt,
        completedAt,
        sourceNodeIds,
        usage: provider.usage,
        persisted,
      },
    } satisfies AgentResult;
  } catch (error) {
    const completedAt = now().toISOString();
    const message = error instanceof Error ? error.message.slice(0, 500) : "AI provider failed";
    try {
      await dependencies.recordRun({
        runId,
        status: "failed",
        provider: "openai",
        model,
        mode: "read-only",
        query,
        sourceNodeIds,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        error: message,
        startedAt,
        completedAt,
        startedAtMs: started.getTime(),
      });
    } catch {
      // Preserve the provider failure; receipt persistence is a secondary failure.
    }
    throw error;
  }
}
