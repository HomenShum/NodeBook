import { randomUUID } from "crypto";

import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { env } from "@/envBackend";
import {
  agentContextSnapshotReference,
  agentMemoryContextReference,
  agentModelRouteReference,
  agentSemanticContextReference,
  getBearerToken,
  getConvexClient,
  recordAgentWorkflowReference,
  reportAgentModelOutcomeReference,
} from "@/lib/convexServer";

import { runOpenAI } from "./openAIProvider";
import { fuseRetrievedContext } from "./retrievalFusion";
import {
  AgentMode,
  executeWorkflowAgent,
  TOOL_DECISION_JSON_SCHEMA,
} from "./workflowAgent";

export const maxDuration = 60;
const RequestSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  consent: z.literal(true),
  mode: z.enum(["ask", "agent", "organize"]).default("ask"),
  executionMode: z.enum(["auto", "plan"]).default("auto"),
  rootNodeId: z.string().min(1).max(200).optional(),
  webResearch: z.boolean().default(false),
});

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
  if (!env.OPENAI_API_KEY && !env.OPENROUTER_API_KEY) return NextResponse.json({ error: "AI provider is not configured" }, { status: 503 });
  if (parsed.data.mode !== "ask" && !parsed.data.rootNodeId) {
    return NextResponse.json({ error: "A current notebook root is required for graph changes" }, { status: 400 });
  }

  const token = getBearerToken(request);
  const convex = getConvexClient(token);
  const runId = randomUUID();
  const started = new Date();
  let selectedModel = env.AGENT_MODEL;
  let selectedProvider: "openai" | "openrouter" = "openai";
  let providerAttempted = false;
  try {
    const [primaryContextNodes, semanticContext, memoryContext, modelRoute] = await Promise.all([
      convex.query(agentContextSnapshotReference, {
        text: parsed.data.query,
        mode: parsed.data.mode,
        limit: parsed.data.mode === "organize" ? 200 : 40,
        rootNodeId: parsed.data.rootNodeId,
      }),
      convex.action(agentSemanticContextReference, { text: parsed.data.query, limit: 12 }),
      convex.query(agentMemoryContextReference, { text: parsed.data.query, limit: 8 }),
      convex.query(agentModelRouteReference, {}),
    ]);
    const contextNodes = fuseRetrievedContext(
      primaryContextNodes,
      semanticContext,
      parsed.data.mode === "organize" ? 200 : 40,
    );
    if (env.OPENROUTER_API_KEY && modelRoute?.primaryModel && !parsed.data.webResearch) {
      selectedModel = modelRoute.primaryModel;
      selectedProvider = "openrouter";
    }
    const runProvider = (providerArgs: Parameters<typeof runOpenAI>[0]) => {
      providerAttempted = true;
      return runOpenAI({
        ...providerArgs,
        provider: selectedProvider,
        fallbackModels: selectedProvider === "openrouter" ? modelRoute?.fallbackModels : undefined,
      });
    };
    const result = await executeWorkflowAgent(
      {
        query: parsed.data.query,
        mode: parsed.data.mode,
        executionMode: parsed.data.executionMode,
        rootNodeId: parsed.data.rootNodeId ?? "home",
        webResearch: parsed.data.webResearch,
        contextNodes,
        memoryContext,
        retrievalStatus: {
          semantic: semanticContext.status,
          reason: semanticContext.reason,
          model: semanticContext.model,
          indexedCount: semanticContext.indexedCount,
          matchedCount: semanticContext.nodes.length,
        },
      },
      {
        model: selectedModel,
        runProvider,
        runToolPlanner: async (plannerArgs) => {
          const planned = await runProvider({
            ...plannerArgs,
            webResearch: false,
            outputSchema: TOOL_DECISION_JSON_SCHEMA as unknown as Record<string, unknown>,
            outputName: "nodebook_agent_tool_decision",
            maxOutputTokens: 400,
          });
          return { result: planned.result, usage: planned.usage };
        },
        runId: () => runId,
      },
    );
    const hasProposal = Boolean(result.proposalId && result.proposalDigest);
    await convex.mutation(recordAgentWorkflowReference, {
      run: {
        runId: result.runId,
        status: hasProposal ? "proposed" : "completed",
        provider: selectedProvider,
        model: result.modelUsed,
        mode: parsed.data.mode,
        query: parsed.data.query,
        sourceNodeIds: result.sourceNodeIds,
        sourceBindings: result.sourceBindings,
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
          executionMode: result.executionMode,
          riskReasons: result.risk.reasons,
        }
        : undefined,
      steps: result.steps,
    });
    await convex.mutation(reportAgentModelOutcomeReference, { success: true, modelId: result.modelUsed });
    return NextResponse.json({
      status: hasProposal ? "proposed" : "completed",
      content: result.content,
      understanding: result.understanding,
      plan: result.plan,
      operations: hasProposal ? result.operations : [],
      proposal: hasProposal
        ? { id: result.proposalId, digest: result.proposalDigest, status: "pending" }
        : null,
      execution: {
        mode: result.executionMode,
        disposition: result.executionDisposition,
        risk: result.risk,
      },
      memory: memoryContext,
      steps: result.steps,
      receipt: {
        runId: result.runId,
        status: hasProposal ? "proposed" : "completed",
        provider: selectedProvider,
        model: result.modelUsed,
        mode: parsed.data.mode,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        sourceNodeIds: result.sourceNodeIds,
        sourceBindings: result.sourceBindings,
        sourceUrls: result.sourceUrls,
        usage: result.usage,
        persisted: true,
      },
    });
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message.slice(0, 500) : "Agent run failed";
    try {
      if (providerAttempted) await convex.mutation(reportAgentModelOutcomeReference, { success: false, modelId: selectedModel });
      await convex.mutation(recordAgentWorkflowReference, {
        run: {
          runId,
          status: "failed",
          provider: selectedProvider,
          model: selectedModel,
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
