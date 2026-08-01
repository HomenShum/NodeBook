import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { env } from "@/envBackend";

const CONVEX_TIMEOUT_MS = 10_000;
const MAX_CONVEX_RESPONSE_BYTES = 8 * 1024 * 1024;

async function readBoundedBody(response: Response) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_CONVEX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Convex response exceeds the 8 MiB response cap");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

export const applySyncReference = makeFunctionReference<
  "mutation",
  { payload: string },
  { status: "ok"; replayed: boolean; applied: number }
>("graph:applySync");

export const beginChunkedNodeUpdateReference = makeFunctionReference<"mutation", any, { status: "ok"; replayed: boolean }>(
  "chunkedNodeUpdates:begin",
);
export const uploadChunkedNodePartReference = makeFunctionReference<"mutation", any, { status: "ok"; replayed: boolean }>(
  "chunkedNodeUpdates:uploadPart",
);
export const finalizeChunkedNodeUpdateReference = makeFunctionReference<
  "mutation",
  { uploadId: string },
  { status: "ok"; replayed: boolean; applied: number }
>("chunkedNodeUpdates:finalize");

export const snapshotPageReference = makeFunctionReference<
  "query",
  {
    table: "nodes" | "relations" | "relationTypes" | "relationLists";
    visibility: "owned" | "public";
    cursor: string | null;
    limit?: number;
  },
  { items: string[]; continueCursor: string; isDone: boolean }
>("graph:snapshotPage");

export const cleanupRelationListTombstonesReference = makeFunctionReference<
  "mutation",
  { limit?: number },
  { inspected: number; deleted: number }
>("graph:cleanupRelationListTombstones");

export const getUserReference = makeFunctionReference<"query", Record<string, never>, string | null>("graph:getUser");

export const getOrCreateUserReference = makeFunctionReference<
  "mutation",
  { payload: string },
  string
>("graph:getOrCreateUser");

export const updateUserSettingsReference = makeFunctionReference<
  "mutation",
  { payload: string },
  string
>("graph:updateUserSettings");

export const searchNodesReference = makeFunctionReference<
  "query",
  { text: string; limit?: number },
  string[]
>("graph:searchNodes");
export const recordAgentRunReference = makeFunctionReference<
  "mutation",
  {
    runId: string;
    status: "completed" | "failed";
    provider: "openai" | "openrouter";
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
  },
  any
>("agentRuns:record");
export const agentContextSnapshotReference = makeFunctionReference<
  "query",
  { text: string; mode: "ask" | "agent" | "organize"; limit?: number; rootNodeId?: string },
  { sourceId: string; version: number; contentText: string; document: string; updatedAt: string; retrievalSignals: string[] }[]
>("agentWorkflows:contextSnapshot");
export const agentMemoryContextReference = makeFunctionReference<
  "query",
  { text: string; limit?: number },
  {
    memories: Array<{
      memoryId: string;
      taskClass: string;
      summary: string;
      toolSequence: string[];
      outcome: "success" | "failure" | "rejected" | "undone";
      sourceNodeIds: string[];
      pinned: boolean;
    }>;
    patterns: Array<{
      taskClass: string;
      toolSequence: string[];
      successCount: number;
      failureCount: number;
      successRate: number;
      averageDurationMs: number;
      useCount: number;
    }>;
  }
>("agentWorkflows:memoryContext");
export const agentModelRouteReference = makeFunctionReference<
  "query",
  Record<string, never>,
  { primaryModel?: string; fallbackModels: string[]; benchmarkStatus: "never" | "running" | "ready" | "failed" } | null
>("modelRouting:currentRoute");
export const reportAgentModelOutcomeReference = makeFunctionReference<
  "mutation",
  { success: boolean; modelId?: string },
  { consecutiveFailures: number; rerunScheduled: boolean }
>("modelRouting:reportOutcome");
export const updateAgentMemoryReference = makeFunctionReference<
  "mutation",
  { memoryId: string; action: "pin" | "unpin" | "forget" },
  { status: string }
>("agentWorkflows:updateMemory");
export const agentBindingSnapshotReference = makeFunctionReference<
  "query",
  { sourceIds: string[] },
  { sourceId: string; version: number; contentText: string; document: string; updatedAt: string }[]
>("agentWorkflows:bindingSnapshot");
export const recordAgentWorkflowReference = makeFunctionReference<
  "mutation",
  any,
  { replayed: boolean; runId: string }
>("agentWorkflows:recordResult");
export const getAgentProposalReference = makeFunctionReference<
  "query",
  { proposalId: string },
  any
>("agentWorkflows:getProposal");
export const transitionAgentProposalReference = makeFunctionReference<
  "mutation",
  any,
  { status: string }
>("agentWorkflows:transitionProposal");
export const resolveSlugReference = makeFunctionReference<"query", { slug: string }, string | null>("graph:resolveSlug");
export const listSlugsReference = makeFunctionReference<"query", Record<string, never>, { id: string; slug: string }[]>(
  "graph:listSlugs",
);
export const setSlugReference = makeFunctionReference<
  "mutation",
  { nodeId: string; slug: string | null },
  { id: string; slug: string | null }
>("graph:setSlug");
export const listUsersReference = makeFunctionReference<"query", { userIds: string[] }, string[]>("graph:listUsers");
export const listNotificationsReference = makeFunctionReference<"query", Record<string, never>, any[]>(
  "graph:listNotifications",
);
export const createNotificationReference = makeFunctionReference<
  "mutation",
  { userId: string; nodeId: string },
  string
>("graph:createNotification");
export const markNotificationsReadReference = makeFunctionReference<
  "mutation",
  { notificationId?: any },
  null
>("graph:markNotificationsRead");
export const getExpansionStateReference = makeFunctionReference<"query", { rootObjectId: string }, any>(
  "graph:getExpansionState",
);
export const saveExpansionStateReference = makeFunctionReference<
  "mutation",
  { rootObjectId: string; expandedObjects: string[] },
  null
>("graph:saveExpansionState");
export const deleteExpansionStateReference = makeFunctionReference<"mutation", { rootObjectId: string }, null>(
  "graph:deleteExpansionState",
);
export const readCanonicalPathsReference = makeFunctionReference<
  "query",
  { objectIds: string[] },
  { objectId: string; ancestors: { id: string; label: string }[] }[]
>("graph:readCanonicalPaths");
export const writeCanonicalPathsReference = makeFunctionReference<
  "mutation",
  { entries: { objectId: string; ancestors: { id: string; label: string }[] }[] },
  null
>("graph:writeCanonicalPaths");
export const deleteOwnerDataPageReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { deleted: number; hasMore: boolean }
>("graph:deleteOwnerDataPage");

function assertConvexUrl() {
  if (!env.CONVEX_URL) throw new Error("CONVEX_URL is required when persistence is set to convex");
  const parsed = new URL(env.CONVEX_URL);
  const isLocal = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) {
    throw new Error("CONVEX_URL must use HTTPS unless it targets localhost");
  }
  return parsed.origin;
}

const boundedFetch: typeof fetch = async (input, init) => {
  const allowedOrigin = assertConvexUrl();
  const target = new URL(input instanceof Request ? input.url : input.toString());
  if (target.origin !== allowedOrigin) throw new Error("Refusing a Convex request outside the configured deployment");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Convex request timed out"), CONVEX_TIMEOUT_MS);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const declaredLength = Number(response.headers.get("content-length") || "0");
    if (declaredLength > MAX_CONVEX_RESPONSE_BYTES) {
      throw new Error("Convex response exceeds the 8 MiB response cap");
    }
    const bytes = await readBoundedBody(response);
    return new Response(bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export function getConvexClient(authToken: string) {
  if (!authToken) throw new Error("An Auth0 bearer token is required for Convex persistence");
  return new ConvexHttpClient(assertConvexUrl(), {
    auth: authToken,
    fetch: boundedFetch,
    logger: false,
  });
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token || "" : "";
}
