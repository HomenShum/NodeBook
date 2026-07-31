import { SerializedGraphStore, SerializedGraphStoreSchema } from "@/app/persistence/SerializedData";

const MAX_SNAPSHOT_PAGES = 100;
const MAX_PAGE_BYTES = 8 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 128 * 1024 * 1024;
const MAX_SNAPSHOT_DOCUMENTS = 50_000;
const PAGE_TIMEOUT_MS = 10_000;

async function readBoundedText(response: Response) {
  if (!response.body) return { text: "", bytes: 0 };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PAGE_BYTES) {
        await reader.cancel();
        throw new Error("Convex snapshot page exceeded the 8 MiB client response cap");
      }
      text += decoder.decode(value, { stream: true });
    }
    return { text: text + decoder.decode(), bytes: total };
  } finally {
    reader.releaseLock();
  }
}

type SnapshotTable = "nodes" | "relations" | "relationTypes" | "relationLists";
type SnapshotVisibility = "public" | "owned";

type SnapshotBudget = { bytes: number; documents: number };

async function fetchSnapshotStream(
  authFetch: typeof fetch,
  table: SnapshotTable,
  visibility: SnapshotVisibility,
  budget: SnapshotBudget,
  externalSignal?: AbortSignal,
) {
  const documents: string[] = [];
  let cursor: string | null = null;
  let pageCount = 0;
  do {
    pageCount++;
    if (pageCount > MAX_SNAPSHOT_PAGES) {
      throw new Error(`Convex ${table}/${visibility} snapshot exceeded its page budget`);
    }
    if (externalSignal?.aborted) throw externalSignal.reason ?? new DOMException("Snapshot aborted", "AbortError");
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(externalSignal?.reason ?? "Snapshot aborted");
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort("Convex snapshot page timed out"), PAGE_TIMEOUT_MS);
    let response: Response;
    try {
      const params = new URLSearchParams({ table, visibility });
      if (cursor) params.set("cursor", cursor);
      response = await authFetch(`/api/convex/snapshot?${params}`, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    }
    if (!response.ok) throw new Error(`Convex snapshot page failed with HTTP ${response.status}`);
    const page = await readBoundedText(response);
    budget.bytes += page.bytes;
    if (budget.bytes > MAX_SNAPSHOT_BYTES) {
      throw new Error("Convex snapshot exceeded the 128 MiB client memory budget");
    }
    const envelope = JSON.parse(page.text) as {
      status: "ok";
      data: { items: string[]; continueCursor: string; isDone: boolean };
    };
    if (envelope.status !== "ok" || !Array.isArray(envelope.data?.items)) {
      throw new Error("Convex snapshot page returned an invalid envelope");
    }
    budget.documents += envelope.data.items.length;
    if (budget.documents > MAX_SNAPSHOT_DOCUMENTS) {
      throw new Error("Convex snapshot exceeded the 50,000-document client budget");
    }
    documents.push(...envelope.data.items);
    cursor = envelope.data.isDone ? null : envelope.data.continueCursor;
  } while (cursor);
  return { documents, table, visibility };
}

export async function fetchConvexSnapshot(
  authFetch: typeof fetch,
  options: { signal?: AbortSignal } = {},
): Promise<SerializedGraphStore> {
  const snapshot: SerializedGraphStore = {
    usersById: {},
    nodesById: {},
    relationTypesById: {},
    relationsById: {},
    relationsByNodeId: {},
    pinnedRelationsByNodeId: {},
    noteContentRelationsByNodeId: {},
  };
  const tables: SnapshotTable[] = ["nodes", "relations", "relationTypes", "relationLists"];
  const visibilities: SnapshotVisibility[] = ["public", "owned"];
  const budget: SnapshotBudget = { bytes: 0, documents: 0 };
  const streams = await Promise.all(
    tables.flatMap((table) =>
      visibilities.map((visibility) => fetchSnapshotStream(authFetch, table, visibility, budget, options.signal)),
    ),
  );

  for (const table of tables) {
    for (const visibility of visibilities) {
      const stream = streams.find((candidate) => candidate.table === table && candidate.visibility === visibility)!;
      for (const document of stream.documents) {
          const value = JSON.parse(document);
          if (table === "nodes") snapshot.nodesById[value.id] = value;
          else if (table === "relations") snapshot.relationsById[value.id] = value;
          else if (table === "relationTypes") snapshot.relationTypesById[value.id] = value;
          else {
            const target =
              value.type === "pinned"
                ? snapshot.pinnedRelationsByNodeId
                : value.type === "noteContent"
                  ? snapshot.noteContentRelationsByNodeId
                  : snapshot.relationsByNodeId;
            target[value.nodeId] ??= {};
            target[value.nodeId][value.relationId] = value.newPosition;
          }
      }
    }
  }

  const parsed = SerializedGraphStoreSchema.safeParse(snapshot);
  if (!parsed.success) throw new Error("Convex graph snapshot did not match the NodeBook graph contract");
  return parsed.data;
}
