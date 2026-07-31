import { SerializedGraphStore, SerializedGraphStoreSchema } from "@/app/persistence/SerializedData";

const MAX_SNAPSHOT_PAGES = 100;
const MAX_PAGE_BYTES = 8 * 1024 * 1024;
const PAGE_TIMEOUT_MS = 10_000;

async function readBoundedText(response: Response) {
  if (!response.body) return "";
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
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function fetchConvexSnapshot(authFetch: typeof fetch): Promise<SerializedGraphStore> {
  const snapshot: SerializedGraphStore = {
    usersById: {},
    nodesById: {},
    relationTypesById: {},
    relationsById: {},
    relationsByNodeId: {},
    pinnedRelationsByNodeId: {},
    noteContentRelationsByNodeId: {},
  };
  const tables = ["nodes", "relations", "relationTypes", "relationLists"] as const;
  const visibilities = ["public", "owned"] as const;

  for (const table of tables) {
    for (const visibility of visibilities) {
      let cursor: string | null = null;
      let pageCount = 0;
      do {
        pageCount++;
        if (pageCount > MAX_SNAPSHOT_PAGES) {
          throw new Error(`Convex ${table}/${visibility} snapshot exceeded its page budget`);
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort("Convex snapshot page timed out"), PAGE_TIMEOUT_MS);
        let response: Response;
        try {
          const params = new URLSearchParams({ table, visibility });
          if (cursor) params.set("cursor", cursor);
          response = await authFetch(`/api/convex/snapshot?${params}`, { signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
        if (!response.ok) throw new Error(`Convex snapshot page failed with HTTP ${response.status}`);
        const envelope = JSON.parse(await readBoundedText(response)) as {
          status: "ok";
          data: { items: string[]; continueCursor: string; isDone: boolean };
        };
        if (envelope.status !== "ok" || !Array.isArray(envelope.data?.items)) {
          throw new Error("Convex snapshot page returned an invalid envelope");
        }
        for (const document of envelope.data.items) {
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
        cursor = envelope.data.isDone ? null : envelope.data.continueCursor;
      } while (cursor);
    }
  }

  const parsed = SerializedGraphStoreSchema.safeParse(snapshot);
  if (!parsed.success) throw new Error("Convex graph snapshot did not match the NodeBook graph contract");
  return parsed.data;
}
