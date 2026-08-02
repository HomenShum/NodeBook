import { randomUUID } from "crypto";

import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { encodeNodeAgentEvent, NodeAgentStreamEvent } from "@/app/query/agentStreamProtocol";
import type { AgentQueryResponse } from "@/app/query/types";
import { env } from "@/envBackend";
import {
  agentContextSnapshotReference,
  agentEmbeddingWorkReference,
  agentMemoryContextReference,
  agentModelRouteReference,
  agentSemanticContextReference,
  getBearerToken,
  getConvexClient,
  recordAgentWorkflowReference,
  reportAgentModelOutcomeReference,
  storeAgentEmbeddingsReference,
} from "@/lib/convexServer";

import { runOpenAI, runOpenAIEmbeddings } from "./openAIProvider";
import { buildEmbeddingWrites, chunkEmbeddingWrites } from "./embeddingBoundary";
import { fuseRetrievedContext, SemanticContextResult } from "./retrievalFusion";
import { AgentMode, AgentStep, executeWorkflowAgent, TOOL_DECISION_JSON_SCHEMA } from "./workflowAgent";

// Semantic hydration and the bounded four-step investigation run before final
// synthesis. Keep the platform budget above the sum of those independently
// bounded stages so a healthy (but slower) certified model is not aborted just
// because retrieval was enabled.
export const maxDuration = 120;
const RequestSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  consent: z.literal(true),
  mode: z.enum(["ask", "agent", "organize"]).default("ask"),
  executionMode: z.enum(["auto", "plan"]).default("auto"),
  rootNodeId: z.string().min(1).max(200).optional(),
  webResearch: z.boolean().default(false),
});

function semanticDegradedReason(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.message.includes("timeout")) return "provider_timeout";
    if (/embedding_provider_\d+/.test(error.message)) return error.message;
    if (error.message.startsWith("embedding_")) return error.message;
  }
  return "embedding_unavailable";
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
  if (!env.OPENAI_API_KEY && !env.OPENROUTER_API_KEY)
    return NextResponse.json({ error: "AI provider is not configured" }, { status: 503 });
  if (parsed.data.mode !== "ask" && !parsed.data.rootNodeId) {
    return NextResponse.json({ error: "A current notebook root is required for graph changes" }, { status: 400 });
  }

  const executeRun = async (onStep?: (step: AgentStep) => void) => {
    const token = getBearerToken(request);
    const convex = getConvexClient(token);
    const runId = randomUUID();
    const started = new Date();
    let selectedModel = env.AGENT_MODEL;
    let selectedProvider: "openai" | "openrouter" = "openai";
    let providerAttempted = false;
    try {
      const [primaryContextNodes, embeddingWork, memoryContext, modelRoute] = await Promise.all([
        convex.query(agentContextSnapshotReference, {
          text: parsed.data.query,
          mode: parsed.data.mode,
          limit: parsed.data.mode === "organize" ? 200 : 40,
          rootNodeId: parsed.data.rootNodeId,
        }),
        convex.query(agentEmbeddingWorkReference, { limit: 24 }),
        convex.query(agentMemoryContextReference, { text: parsed.data.query, limit: 8 }),
        convex.query(agentModelRouteReference, {}),
      ]);
      let semanticContext: SemanticContextResult;
      try {
        const embeddingResult = await runOpenAIEmbeddings({
          input: [parsed.data.query, ...embeddingWork.map((item) => item.contentText)],
          timeoutMs: 8_000,
        });
        const embeddingWrites = buildEmbeddingWrites(embeddingWork, embeddingResult.embeddings.slice(1));
        let storedCount = 0;
        for (const items of chunkEmbeddingWrites(embeddingWrites)) {
          const stored = await convex.mutation(storeAgentEmbeddingsReference, { items });
          storedCount += stored.stored;
        }
        const semanticNodes = await convex.action(agentSemanticContextReference, {
          queryEmbedding: embeddingResult.embeddings[0],
          limit: 12,
        });
        semanticContext = {
          status: "ready",
          model: embeddingResult.model,
          indexedCount: storedCount,
          nodes: semanticNodes,
        };
      } catch (error) {
        semanticContext = {
          status: "degraded",
          reason: semanticDegradedReason(error),
          model: "text-embedding-3-small",
          indexedCount: 0,
          nodes: [],
        };
      }
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
          onStep,
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
      const responseBody: AgentQueryResponse = {
        status: hasProposal ? "proposed" : "completed",
        content: result.content,
        understanding: result.understanding,
        plan: result.plan,
        operations: hasProposal ? result.operations : [],
        proposal: hasProposal ? { id: result.proposalId!, digest: result.proposalDigest!, status: "pending" } : null,
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
      };
      return { status: 200 as const, body: responseBody };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message.slice(0, 500) : "Agent run failed";
      try {
        if (providerAttempted)
          await convex.mutation(reportAgentModelOutcomeReference, { success: false, modelId: selectedModel });
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
      return { status: 502 as const, body: { error: "Agent run failed before completion" } };
    }
  };

  if (request.headers.get("accept")?.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    let streamClosed = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: NodeAgentStreamEvent) => {
          if (streamClosed) return;
          try {
            controller.enqueue(encoder.encode(encodeNodeAgentEvent(event)));
          } catch {
            streamClosed = true;
          }
        };
        send({ type: "thought", data: { message: "Reviewing owner-scoped notebook context." } });
        void executeRun((step) => {
          send({ type: "tool_call", data: { name: step.tool } });
          send({ type: "tool_result", data: { name: step.tool, success: step.status !== "failed", step } });
        })
          .then((outcome) => {
            if (outcome.status >= 400 || "error" in outcome.body) {
              send({ type: "error", data: { message: "Agent run failed before completion" } });
              send({ type: "end", data: { status: "failed" } });
              return;
            }
            const result = outcome.body;
            if (result.proposal && result.operations.length > 0) {
              send({
                type: "client_action",
                data: {
                  proposalId: result.proposal.id,
                  operationCount: result.operations.length,
                  disposition: result.execution.disposition,
                },
              });
            }
            send({ type: "final_summary", data: { result } });
            send({ type: "end", data: { status: "completed" } });
          })
          .catch(() => {
            send({ type: "error", data: { message: "Agent run failed before completion" } });
            send({ type: "end", data: { status: "failed" } });
          })
          .finally(() => {
            if (!streamClosed) {
              streamClosed = true;
              controller.close();
            }
          });
      },
      cancel() {
        streamClosed = true;
      },
    });
    return new NextResponse(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const outcome = await executeRun();
  return NextResponse.json(outcome.body, { status: outcome.status });
});
