import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { GraphUpdateSchema } from "@/app/graph/GraphUpdate";
import { digest } from "@/app/api/query/workflowAgent";
import {
  agentBindingSnapshotReference,
  getAgentProposalReference,
  getBearerToken,
  getConvexClient,
  transitionAgentProposalReference,
} from "@/lib/convexServer";

const MAX_UPDATE_COUNT = 500;
const MAX_UPDATE_JSON_BYTES = 512 * 1024;
const TransitionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
    proposalId: z.string().min(1),
    proposalDigest: z.string().length(64),
  }),
  z.object({
    action: z.literal("reject"),
    proposalId: z.string().min(1),
    proposalDigest: z.string().length(64),
  }),
  z.object({
    action: z.literal("applied"),
    proposalId: z.string().min(1),
    proposalDigest: z.string().length(64),
    appliedUpdates: z.array(GraphUpdateSchema).max(MAX_UPDATE_COUNT),
    inverseUpdates: z.array(GraphUpdateSchema).max(MAX_UPDATE_COUNT),
  }),
  z.object({
    action: z.literal("failed"),
    proposalId: z.string().min(1),
    proposalDigest: z.string().length(64),
    error: z.string().min(1).max(500),
  }),
  z.object({
    action: z.literal("undo"),
    proposalId: z.string().min(1),
    proposalDigest: z.string().length(64),
  }),
]);

function parsedNodeForDigest(node: {
  sourceId: string;
  version: number;
  contentText: string;
  document: string;
}) {
  let document: unknown = null;
  try {
    document = JSON.parse(node.document);
  } catch {
    document = { content: node.contentText };
  }
  return { id: node.sourceId, version: node.version, text: node.contentText, document };
}

function publicProposal(record: any) {
  const sourceNodeIds = JSON.parse(record.proposal.sourceBindingsJson).map(
    (binding: { sourceId: string }) => binding.sourceId,
  );
  return {
    id: record.proposal.proposalId,
    digest: record.proposal.proposalDigest,
    status: record.proposal.status,
    mode: record.proposal.mode,
    understanding: record.proposal.understanding,
    plan: record.proposal.plan,
    summary: record.proposal.summary,
    operations: JSON.parse(record.proposal.operationsJson),
    inverseUpdates: record.proposal.inverseUpdatesJson
      ? JSON.parse(record.proposal.inverseUpdatesJson)
      : null,
    error: record.proposal.error ?? null,
    steps: record.steps,
    receipt: {
      runId: record.proposal.runId,
      status: "proposed",
      provider: "openai",
      model: record.run?.model ?? "unknown",
      mode: record.proposal.mode,
      startedAt: record.run?.startedAt ?? record.proposal.createdAt,
      completedAt: record.run?.completedAt ?? record.proposal.createdAt,
      sourceNodeIds,
      sourceUrls: record.run?.sourceUrls ?? [],
      usage: {
        inputTokens: record.run?.inputTokens ?? null,
        outputTokens: record.run?.outputTokens ?? null,
        totalTokens: record.run?.totalTokens ?? null,
      },
      persisted: true,
    },
  };
}

export const GET = withAuth(async (request: NextAuthenticatedRequest) => {
  const proposalId = new URL(request.url).searchParams.get("proposalId")?.trim();
  if (!proposalId) return NextResponse.json({ error: "proposalId is required" }, { status: 400 });
  const convex = getConvexClient(getBearerToken(request));
  const record = await convex.query(getAgentProposalReference, { proposalId });
  if (!record) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  return NextResponse.json({ proposal: publicProposal(record) });
});

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = TransitionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid proposal transition" }, { status: 400 });
  const convex = getConvexClient(getBearerToken(request));
  const record = await convex.query(getAgentProposalReference, { proposalId: parsed.data.proposalId });
  if (!record) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (record.proposal.proposalDigest !== parsed.data.proposalDigest) {
    return NextResponse.json({ error: "Proposal digest mismatch" }, { status: 409 });
  }
  const now = new Date().toISOString();

  try {
    if (parsed.data.action === "accept") {
      if (record.proposal.status !== "pending") {
        return NextResponse.json({ error: `Proposal is already ${record.proposal.status}` }, { status: 409 });
      }
      const bindings = z.array(z.object({
        sourceId: z.string(),
        version: z.number(),
        digest: z.string().length(64),
      })).max(200).parse(JSON.parse(record.proposal.sourceBindingsJson));
      const current = await convex.query(agentBindingSnapshotReference, {
        sourceIds: bindings.map((binding) => binding.sourceId),
      });
      const byId = new Map(current.map((node) => [node.sourceId, node]));
      const stale = bindings.filter((binding) => {
        const node = byId.get(binding.sourceId);
        return !node || node.version !== binding.version || digest(parsedNodeForDigest(node)) !== binding.digest;
      });
      if (stale.length) {
        return NextResponse.json(
          {
            error: "Notebook changed after this proposal was generated. Review a fresh proposal.",
            staleSourceNodeIds: stale.map((binding) => binding.sourceId),
          },
          { status: 409 },
        );
      }
      await convex.mutation(transitionAgentProposalReference, {
        proposalId: parsed.data.proposalId,
        proposalDigest: parsed.data.proposalDigest,
        fromStatus: "pending",
        toStatus: "accepted",
        at: now,
      });
      return NextResponse.json({
        status: "accepted",
        operations: JSON.parse(record.proposal.operationsJson),
      });
    }

    if (parsed.data.action === "reject") {
      await convex.mutation(transitionAgentProposalReference, {
        proposalId: parsed.data.proposalId,
        proposalDigest: parsed.data.proposalDigest,
        fromStatus: "pending",
        toStatus: "rejected",
        at: now,
      });
      return NextResponse.json({ status: "rejected" });
    }

    if (parsed.data.action === "applied") {
      const appliedUpdatesJson = JSON.stringify(parsed.data.appliedUpdates);
      const inverseUpdatesJson = JSON.stringify(parsed.data.inverseUpdates);
      if (Buffer.byteLength(appliedUpdatesJson) + Buffer.byteLength(inverseUpdatesJson) > MAX_UPDATE_JSON_BYTES) {
        return NextResponse.json({ error: "Applied update receipt is too large" }, { status: 413 });
      }
      await convex.mutation(transitionAgentProposalReference, {
        proposalId: parsed.data.proposalId,
        proposalDigest: parsed.data.proposalDigest,
        fromStatus: "accepted",
        toStatus: "applied",
        at: now,
        appliedUpdatesJson,
        inverseUpdatesJson,
      });
      return NextResponse.json({ status: "applied" });
    }

    if (parsed.data.action === "failed") {
      await convex.mutation(transitionAgentProposalReference, {
        proposalId: parsed.data.proposalId,
        proposalDigest: parsed.data.proposalDigest,
        fromStatus: "accepted",
        toStatus: "failed",
        at: now,
        error: parsed.data.error,
      });
      return NextResponse.json({ status: "failed" });
    }

    await convex.mutation(transitionAgentProposalReference, {
      proposalId: parsed.data.proposalId,
      proposalDigest: parsed.data.proposalDigest,
      fromStatus: "applied",
      toStatus: "undone",
      at: now,
    });
    return NextResponse.json({ status: "undone" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proposal transition failed";
    const status = /CONFLICT|MISMATCH|INVALID_PROPOSAL_TRANSITION/.test(message) ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? message : "Proposal transition failed" }, { status });
  }
});
