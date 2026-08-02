import { randomUUID } from "crypto";

import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { runOpenAI } from "@/app/api/query/openAIProvider";
import { executeWorkflowAgent, TOOL_DECISION_JSON_SCHEMA, type WorkflowUsage } from "@/app/api/query/workflowAgent";
import { env } from "@/envBackend";
import { agentModelRouteReference, getBearerToken, getConvexClient, recentAgentRuntimeEvaluationsReference, recordAgentRuntimeEvaluationReference } from "@/lib/convexServer";

import { getLiveEvalCase, LIVE_EVAL_CASES, LIVE_EVAL_VERSION, scoreLiveEval } from "./liveEval";
import { boundedExecutionFailureReason, combineObservedUsage } from "./runtimeEvalFailure";

export const maxDuration = 60;
const RequestSchema = z.object({
  caseId: z.string().min(1).max(100),
  consent: z.literal(true),
  suiteId: z.string().min(1).max(100).optional(),
});

export const GET = withAuth(async (request: NextAuthenticatedRequest) => {
  try {
    const convex = getConvexClient(getBearerToken(request));
    const [evaluations, modelRoute] = await Promise.all([
      convex.query(recentAgentRuntimeEvaluationsReference, { limit: 100 }),
      convex.query(agentModelRouteReference, {}),
    ]);
    const provider: "openai" | "openrouter" = env.OPENROUTER_API_KEY && modelRoute?.primaryModel ? "openrouter" : "openai";
    return NextResponse.json({
      benchmarkVersion: LIVE_EVAL_VERSION,
      cases: LIVE_EVAL_CASES.map(({ caseId, title }) => ({ caseId, title })),
      preflight: {
        provider,
        model: provider === "openrouter" ? modelRoute!.primaryModel! : env.AGENT_MODEL,
        fallbackModels: provider === "openrouter" ? modelRoute?.fallbackModels ?? [] : [],
      },
      evaluations: evaluations.map((evaluation: any) => ({
        evalId: evaluation.evalId,
        suiteId: evaluation.suiteId ?? null,
        caseId: evaluation.caseId,
        benchmarkVersion: evaluation.benchmarkVersion,
        provider: evaluation.provider,
        model: evaluation.model,
        mode: evaluation.mode,
        disposition: evaluation.disposition,
        passed: evaluation.passed,
        reasons: evaluation.reasons,
        toolOrder: evaluation.toolOrder,
        operationKinds: evaluation.operationKinds,
        selectedNodeIds: evaluation.selectedNodeIds,
        sourceBindings: evaluation.sourceBindings,
        proposalDigest: evaluation.proposalDigest ?? null,
        usage: { inputTokens: evaluation.inputTokens, outputTokens: evaluation.outputTokens, totalTokens: evaluation.totalTokens },
        latencyMs: evaluation.latencyMs,
        startedAtMs: evaluation.startedAtMs,
        completedAtMs: evaluation.completedAtMs,
        persisted: true,
        graphMutated: false,
      })),
    });
  } catch (error) {
    console.error("NodeAgent evaluation history failed", error);
    captureException(error, { user: { id: request.userId } });
    return NextResponse.json({ error: "NodeAgent evaluation history is unavailable" }, { status: 502 });
  }
});

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
    let observedModel = model;
    const observedUsage: WorkflowUsage[] = [];
    const runProvider = async (args: Parameters<typeof runOpenAI>[0]) => {
      const response = await runOpenAI({
        ...args,
        provider,
        fallbackModels: provider === "openrouter" ? modelRoute?.fallbackModels : undefined,
      });
      observedModel = response.actualModel ?? args.model;
      observedUsage.push(response.usage);
      return response;
    };
    let result;
    try {
      result = await executeWorkflowAgent({
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
    } catch (executionError) {
      const completedAtMs = Date.now();
      const evalId = randomUUID();
      const usage = combineObservedUsage(observedUsage);
      const reasons = [boundedExecutionFailureReason(executionError)];
      await convex.mutation(recordAgentRuntimeEvaluationReference, {
        evaluation: {
          evalId,
          suiteId: parsed.data.suiteId,
          caseId: testCase.caseId,
          benchmarkVersion: LIVE_EVAL_VERSION,
          provider,
          model: observedModel,
          mode: testCase.mode,
          disposition: "execution_failed",
          passed: false,
          reasons,
          toolOrder: [],
          operationKinds: [],
          selectedNodeIds: [],
          sourceBindings: [],
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          latencyMs: completedAtMs - startedAtMs,
          startedAtMs,
          completedAtMs,
        },
      });
      return NextResponse.json({
        status: "failed",
        caseId: testCase.caseId,
        receipt: { evalId, suiteId: parsed.data.suiteId ?? null, caseId: testCase.caseId, benchmarkVersion: LIVE_EVAL_VERSION, provider, model: observedModel, passed: false, reasons, toolOrder: [], operationKinds: [], disposition: "execution_failed", selectedNodeIds: [], sourceBindings: [], proposalDigest: null, usage, latencyMs: completedAtMs - startedAtMs, startedAtMs, completedAtMs, persisted: true, graphMutated: false },
      }, { status: 422 });
    }
    const score = scoreLiveEval(testCase, result);
    const completedAtMs = Date.now();
    const evalId = randomUUID();
    await convex.mutation(recordAgentRuntimeEvaluationReference, {
      evaluation: {
        evalId,
        suiteId: parsed.data.suiteId,
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
      receipt: { evalId, suiteId: parsed.data.suiteId ?? null, caseId: testCase.caseId, benchmarkVersion: LIVE_EVAL_VERSION, provider, model: result.modelUsed, ...score, disposition: result.executionDisposition, selectedNodeIds: result.sourceNodeIds, sourceBindings: result.sourceBindings, proposalDigest: result.proposalDigest, usage: result.usage, latencyMs: completedAtMs - startedAtMs, startedAtMs, completedAtMs, persisted: true, graphMutated: false },
    }, { status: score.passed ? 200 : 422 });
  } catch (error) {
    console.error("NodeAgent live evaluation failed", error);
    captureException(error, { user: { id: request.userId } });
    return NextResponse.json({ error: "NodeAgent live evaluation failed before a durable receipt was produced" }, { status: 502 });
  }
});
