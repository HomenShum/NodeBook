import { randomUUID } from "crypto";

import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { runOpenAI } from "@/app/api/query/openAIProvider";
import { executeWorkflowAgent, TOOL_DECISION_JSON_SCHEMA } from "@/app/api/query/workflowAgent";
import { env } from "@/envBackend";
import { agentModelRouteReference, getBearerToken, getConvexClient, recordAgentRuntimeEvaluationReference } from "@/lib/convexServer";

import { getLiveEvalCase, LIVE_EVAL_VERSION, scoreLiveEval } from "./liveEval";

export const maxDuration = 60;
const RequestSchema = z.object({ caseId: z.string().min(1).max(100), consent: z.literal(true) });

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  const startedAtMs = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A valid caseId and explicit consent are required" }, { status: 400 });
  try {
    const testCase = getLiveEvalCase(parsed.data.caseId);
    if (!testCase) return NextResponse.json({ error: "Unknown locked evaluation case" }, { status: 404 });
    if (!env.OPENAI_API_KEY && !env.OPENROUTER_API_KEY) return NextResponse.json({ error: "AI provider is not configured" }, { status: 503 });

    const convex = getConvexClient(getBearerToken(request));
    const modelRoute = await convex.query(agentModelRouteReference, {});
    const provider: "openai" | "openrouter" = env.OPENROUTER_API_KEY && modelRoute?.primaryModel ? "openrouter" : "openai";
    const model = provider === "openrouter" ? modelRoute!.primaryModel! : env.AGENT_MODEL;
    const runProvider = (args: Parameters<typeof runOpenAI>[0]) => runOpenAI({
      ...args,
      provider,
      fallbackModels: provider === "openrouter" ? modelRoute?.fallbackModels : undefined,
    });
    const result = await executeWorkflowAgent({
      query: testCase.query,
      mode: testCase.mode,
      executionMode: "auto",
      rootNodeId: testCase.rootNodeId,
      webResearch: false,
      contextNodes: testCase.contextNodes,
      memoryContext: { memories: [], patterns: [] },
    }, {
      model,
      runId: randomUUID,
      proposalId: randomUUID,
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
    });
    const score = scoreLiveEval(testCase, result);
    const completedAtMs = Date.now();
    const evalId = randomUUID();
    await convex.mutation(recordAgentRuntimeEvaluationReference, {
      evaluation: {
        evalId,
        caseId: testCase.caseId,
        benchmarkVersion: LIVE_EVAL_VERSION,
        provider,
        model: result.modelUsed,
        mode: testCase.mode,
        disposition: result.executionDisposition,
        passed: score.passed,
        reasons: score.reasons,
        toolOrder: score.toolOrder,
        operationKinds: score.operationKinds,
        selectedNodeIds: result.sourceNodeIds,
        sourceBindings: result.sourceBindings,
        proposalDigest: result.proposalDigest ?? undefined,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        latencyMs: completedAtMs - startedAtMs,
        startedAtMs,
        completedAtMs,
      },
    });
    return NextResponse.json({
      status: score.passed ? "passed" : "failed",
      caseId: testCase.caseId,
      receipt: { evalId, benchmarkVersion: LIVE_EVAL_VERSION, provider, model: result.modelUsed, ...score, disposition: result.executionDisposition, selectedNodeIds: result.sourceNodeIds, sourceBindings: result.sourceBindings, proposalDigest: result.proposalDigest, usage: result.usage, latencyMs: completedAtMs - startedAtMs, persisted: true, graphMutated: false },
    }, { status: score.passed ? 200 : 422 });
  } catch (error) {
    console.error("NodeAgent live evaluation failed", error);
    captureException(error, { user: { id: request.userId } });
    return NextResponse.json({ error: "NodeAgent live evaluation failed before a durable receipt was produced" }, { status: 502 });
  }
});
