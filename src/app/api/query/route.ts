import { randomUUID } from "crypto";

import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { env } from "@/envBackend";
import {
  agentContextSnapshotReference,
  getBearerToken,
  getConvexClient,
  recordAgentWorkflowReference,
} from "@/lib/convexServer";

import {
  AgentMode,
  executeWorkflowAgent,
  RESULT_JSON_SCHEMA,
  WorkflowUsage,
} from "./workflowAgent";

export const maxDuration = 60;
const MAX_OPENAI_RESPONSE_BYTES = 2 * 1024 * 1024;
const RequestSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  consent: z.literal(true),
  mode: z.enum(["ask", "agent", "organize"]).default("ask"),
  rootNodeId: z.string().min(1).max(200).optional(),
  webResearch: z.boolean().default(false),
});

async function readBoundedJson(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > MAX_OPENAI_RESPONSE_BYTES) throw new Error("AI provider response exceeded the size limit");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_OPENAI_RESPONSE_BYTES) {
    throw new Error("AI provider response exceeded the size limit");
  }
  return JSON.parse(text) as Record<string, any>;
}

function extractOutputText(body: Record<string, any>) {
  if (typeof body.output_text === "string") return body.output_text;
  if (!Array.isArray(body.output)) return "";
  return body.output
    .flatMap((item: any) => (Array.isArray(item.content) ? item.content : []))
    .map((item: any) => (typeof item.text === "string" ? item.text : ""))
    .join("");
}

function extractSourceUrls(body: Record<string, any>) {
  const urls = new Set<string>();
  for (const item of Array.isArray(body.output) ? body.output.slice(0, 100) : []) {
    for (const source of Array.isArray(item?.action?.sources) ? item.action.sources.slice(0, 50) : []) {
      if (typeof source?.url === "string") urls.add(source.url);
    }
    for (const content of Array.isArray(item?.content) ? item.content.slice(0, 50) : []) {
      for (const annotation of Array.isArray(content?.annotations) ? content.annotations.slice(0, 50) : []) {
        if (typeof annotation?.url === "string") urls.add(annotation.url);
      }
    }
  }
  return [...urls].slice(0, 20);
}

async function runOpenAI(args: {
  input: string;
  instructions: string;
  model: string;
  webResearch: boolean;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("AI provider timed out"), args.timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: args.model,
        store: false,
        max_output_tokens: 2_500,
        instructions: args.instructions,
        input: args.input,
        tools: args.webResearch ? [{ type: "web_search" }] : [],
        text: {
          format: {
            type: "json_schema",
            name: "nodebook_agent_result",
            strict: true,
            schema: RESULT_JSON_SCHEMA,
          },
        },
      }),
      signal: controller.signal,
    });
    const body = await readBoundedJson(response);
    if (!response.ok) throw new Error(`AI provider rejected the run (${response.status})`);
    const content = extractOutputText(body);
    if (!content.trim()) throw new Error("AI provider returned an empty response");
    let result: unknown;
    try {
      result = JSON.parse(content);
    } catch {
      throw new Error("AI provider returned malformed structured output");
    }
    const usage: WorkflowUsage = {
      inputTokens: typeof body.usage?.input_tokens === "number" ? body.usage.input_tokens : null,
      outputTokens: typeof body.usage?.output_tokens === "number" ? body.usage.output_tokens : null,
      totalTokens: typeof body.usage?.total_tokens === "number" ? body.usage.total_tokens : null,
    };
    return { result, sources: extractSourceUrls(body), usage };
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const consentMissing = typeof body === "object" && body !== null && (body as any).consent !== true;
    return NextResponse.json(
      { error: consentMissing ? "Explicit consent is required for an AI run" : "Invalid agent request" },
      { status: consentMissing ? 403 : 400 },
    );
  }
  if (!env.OPENAI_API_KEY) return NextResponse.json({ error: "AI provider is not configured" }, { status: 503 });
  if (parsed.data.mode !== "ask" && !parsed.data.rootNodeId) {
    return NextResponse.json({ error: "A current notebook root is required for proposed changes" }, { status: 400 });
  }

  const token = getBearerToken(request);
  const convex = getConvexClient(token);
  const runId = randomUUID();
  const started = new Date();
  try {
    const contextNodes = await convex.query(agentContextSnapshotReference, {
      text: parsed.data.query,
      mode: parsed.data.mode,
      limit: parsed.data.mode === "organize" ? 200 : 40,
    });
    const result = await executeWorkflowAgent(
      {
        query: parsed.data.query,
        mode: parsed.data.mode,
        rootNodeId: parsed.data.rootNodeId ?? "home",
        webResearch: parsed.data.webResearch,
        contextNodes,
      },
      {
        model: env.AGENT_MODEL,
        runProvider: runOpenAI,
        runId: () => runId,
      },
    );
    const hasProposal = Boolean(result.proposalId && result.proposalDigest);
    await convex.mutation(recordAgentWorkflowReference, {
      run: {
        runId: result.runId,
        status: hasProposal ? "proposed" : "completed",
        provider: "openai",
        model: env.AGENT_MODEL,
        mode: parsed.data.mode,
        query: parsed.data.query,
        sourceNodeIds: result.sourceNodeIds,
        sourceUrls: result.sourceUrls,
        proposalId: result.proposalId ?? undefined,
        summary: result.finishSummary,
        stepCount: result.steps.length,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        startedAtMs: result.startedAtMs,
      },
      proposal: hasProposal
        ? {
          proposalId: result.proposalId,
          proposalDigest: result.proposalDigest,
          status: "pending",
          mode: parsed.data.mode,
          understanding: result.understanding,
          plan: result.plan,
          summary: result.finishSummary,
          operationsJson: JSON.stringify(result.operations),
          sourceBindingsJson: JSON.stringify(result.sourceBindings),
          createdAt: result.completedAt,
          createdAtMs: Date.parse(result.completedAt),
        }
        : undefined,
      steps: result.steps,
    });
    return NextResponse.json({
      status: hasProposal ? "proposed" : "completed",
      content: result.content,
      understanding: result.understanding,
      plan: result.plan,
      operations: hasProposal ? result.operations : [],
      proposal: hasProposal
        ? { id: result.proposalId, digest: result.proposalDigest, status: "pending" }
        : null,
      steps: result.steps,
      receipt: {
        runId: result.runId,
        status: hasProposal ? "proposed" : "completed",
        provider: "openai",
        model: env.AGENT_MODEL,
        mode: parsed.data.mode,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        sourceNodeIds: result.sourceNodeIds,
        sourceUrls: result.sourceUrls,
        usage: result.usage,
        persisted: true,
      },
    });
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message.slice(0, 500) : "Agent run failed";
    try {
      await convex.mutation(recordAgentWorkflowReference, {
        run: {
          runId,
          status: "failed",
          provider: "openai",
          model: env.AGENT_MODEL,
          mode: parsed.data.mode as AgentMode,
          query: parsed.data.query,
          sourceNodeIds: [],
          sourceUrls: [],
          summary: "Agent run failed before a reviewable result was produced.",
          stepCount: 0,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          error: message,
          startedAt: started.toISOString(),
          completedAt,
          startedAtMs: started.getTime(),
        },
        steps: [],
      });
    } catch {
      // Preserve the primary failure; the UI still receives an honest non-2xx result.
    }
    console.error("NodeBook agent run failed", error);
    captureException(error, { user: { id: request.userId } });
    return NextResponse.json({ error: "Agent run failed before completion" }, { status: 502 });
  }
});
