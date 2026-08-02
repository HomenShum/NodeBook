import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { buildMemoryProjection, MAX_MEMORY_PROJECTION_SOURCES } from "@/app/api/query/memoryProjection";
import { digest, sourceBindingDigest } from "@/app/api/query/workflowAgent";
import type { AgentMemory, AgentStep } from "@/app/query/types";
import {
  agentBindingSnapshotReference,
  agentMemoryDetailReference,
  getBearerToken,
  getConvexClient,
  recordAgentWorkflowReference,
  updateAgentMemoryReference,
} from "@/lib/convexServer";

const RequestSchema = z.discriminatedUnion("action", [
  z.object({
    memoryId: z.string().min(1).max(500),
    action: z.enum(["pin", "unpin", "forget"]),
  }),
  z.object({
    memoryId: z.string().min(1).max(500),
    action: z.literal("project"),
    rootNodeId: z.string().min(1).max(200),
  }),
]);

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid memory action" }, { status: 400 });
  try {
    const convex = getConvexClient(getBearerToken(request));
    if (parsed.data.action !== "project") {
      return NextResponse.json(await convex.mutation(updateAgentMemoryReference, parsed.data));
    }
    const projectionRequest = parsed.data as Extract<z.infer<typeof RequestSchema>, { action: "project" }>;

    const memory = await convex.query(agentMemoryDetailReference, { memoryId: projectionRequest.memoryId });
    if (!memory) return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    const sourceIds = [...new Set(memory.sourceNodeIds)]
      .filter((sourceId) => sourceId !== projectionRequest.rootNodeId)
      .slice(0, MAX_MEMORY_PROJECTION_SOURCES);
    const nodes = await convex.query(agentBindingSnapshotReference, {
      sourceIds: [projectionRequest.rootNodeId, ...sourceIds],
    });
    const projection = buildMemoryProjection({
      memory: memory as AgentMemory,
      rootNodeId: projectionRequest.rootNodeId,
      nodes,
    });
    const bindingNodes = [
      nodes.find((node) => node.sourceId === projectionRequest.rootNodeId),
      ...projection.sourceNodes,
    ].filter((node): node is NonNullable<typeof node> => Boolean(node));
    const sourceBindings = bindingNodes.map((node) => ({
      sourceId: node.sourceId,
      version: node.version,
      digest: sourceBindingDigest(node),
    }));
    const proposalId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    const at = now.toISOString();
    const proposalDigest = digest({
      proposalId,
      mode: "agent",
      operations: projection.operations,
      sourceBindings,
    });
    const durableSteps = [
      {
        sequence: 1,
        tool: "inspect_typed_memory",
        status: "completed" as const,
        inputDigest: digest({ memoryId: memory.memoryId }),
        outputDigest: digest({ sourceNodeIds: projection.sourceNodes.map((node) => node.sourceId) }),
        summary: `Inspected one typed memory with ${projection.sourceNodes.length} available source${projection.sourceNodes.length === 1 ? "" : "s"}.`,
        startedAt: at,
        completedAt: at,
      },
      {
        sequence: 2,
        tool: "checkpoint_memory_projection",
        status: "completed" as const,
        inputDigest: digest(projection.operations),
        outputDigest: proposalDigest,
        summary: `Prepared ${projection.operations.length} reversible graph operation${projection.operations.length === 1 ? "" : "s"}.`,
        startedAt: at,
        completedAt: at,
      },
    ];
    await convex.mutation(recordAgentWorkflowReference, {
      run: {
        runId,
        status: "proposed",
        provider: "nodebook",
        model: "deterministic-memory-projection-v1",
        mode: "agent",
        query: "Project one recalled memory into the current notebook.",
        sourceNodeIds: projection.sourceNodes.map((node) => node.sourceId),
        sourceBindings,
        sourceUrls: [],
        proposalId,
        memoryEligible: false,
        summary: "Prepared one cited typed-memory projection.",
        stepCount: durableSteps.length,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        startedAt: at,
        completedAt: at,
        startedAtMs: now.getTime(),
      },
      proposal: {
        proposalId,
        proposalDigest,
        status: "pending",
        mode: "agent",
        understanding: "Project the inspected typed memory into the current notebook with exact source relations.",
        plan: ["Create one readable memory note.", "Connect it to the available cited notebook sources."],
        summary: "Prepared one cited typed-memory projection.",
        operationsJson: JSON.stringify(projection.operations),
        sourceBindingsJson: JSON.stringify(sourceBindings),
        executionMode: "auto",
        riskReasons: [],
        createdAt: at,
        createdAtMs: now.getTime(),
      },
      steps: durableSteps,
    });
    const publicSteps: AgentStep[] = durableSteps.map(({ sequence, tool, status, summary }) => ({ sequence, tool, status, summary }));
    return NextResponse.json({
      content: "Prepared one provenance-rich memory projection for automatic checkpointed application.",
      understanding: "Project the inspected typed memory into the current notebook with exact source relations.",
      plan: ["Create one readable memory note.", "Connect it to the available cited notebook sources."],
      operations: projection.operations,
      steps: publicSteps,
      proposal: { id: proposalId, digest: proposalDigest, status: "pending" },
      receipt: {
        runId,
        status: "proposed",
        provider: "nodebook",
        model: "deterministic-memory-projection-v1",
        mode: "agent",
        startedAt: at,
        completedAt: at,
        sourceNodeIds: projection.sourceNodes.map((node) => node.sourceId),
        sourceBindings,
        sourceUrls: [],
        usage: { inputTokens: null, outputTokens: null, totalTokens: null },
        persisted: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Memory action failed";
    const status = message.includes("NOT_FOUND") ? 404 : message.includes("LIMIT") || message.includes("CONFLICT") ? 409 : 502;
    return NextResponse.json({ error: message.slice(0, 300) }, { status });
  }
});
