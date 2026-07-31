import { captureException } from "@sentry/nextjs";
import { computed, makeObservable, observable, runInAction } from "mobx";

import { env } from "@/app/envFrontend";
import { generateInverseUpdates, GraphUpdate } from "@/app/graph/GraphUpdate";
import { ChunkedNodeSyncEventSchema, condenseSyncDataBatch, SyncData, SyncDataSchema } from "@/app/graph/SyncData";
import { getEntityIdsFromUpdates } from "@/app/graph/utils";
import { SerializedGraphStore } from "@/app/persistence/SerializedData";
import { fetchConvexSnapshot } from "@/app/persistence/fetchConvexSnapshot";
import { uuid } from "@/app/util";
import appLogger from "@/lib/logger";

const logger = appLogger.child({ service: "UpdateManager" });

const MAX_PENDING_SYNC_ENTITIES = 10_000;
const MAX_SYNC_QUEUE_ITEMS = 2_000;
const SYNC_REQUEST_TIMEOUT_MS = 10_000;
const MAX_INLINE_NODE_BYTES = 200 * 1024;
const CHUNKED_NODE_PART_BYTES = 96 * 1024;

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function canonicalEntityForCas(entity: Record<string, unknown>) {
  const {
    canonicalRelationId: _canonicalRelationId,
    relationCount: _relationCount,
    slug: _slug,
    updatedAt: _updatedAt,
    ...stable
  } = entity;
  return canonical(stable);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function splitUtf8(value: string) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let parts: string[] = [];
  let bytes = 0;
  for (const character of value) {
    const characterBytes = encoder.encode(character).byteLength;
    if (bytes + characterBytes > CHUNKED_NODE_PART_BYTES && parts.length) {
      chunks.push(parts.join(""));
      parts = [];
      bytes = 0;
    }
    parts.push(character);
    bytes += characterBytes;
  }
  if (parts.length) chunks.push(parts.join(""));
  return chunks;
}

/**
 * Represents a transaction that can be undone/redone, potentially with selection state
 */
export interface TransactionObject {
  updates: GraphUpdate[];
  hasSelectionState: boolean;
  id: string; // Unique ID for this transaction, used to match selection states
}

export class UpdateManager {
  private clientId = uuid();
  private userId: string;

  private isSyncing = false;
  private static pendingNodeSyncCounts = new Map<string, number>();
  private nextSyncId: ReturnType<typeof setTimeout> | number = 0;

  /**
   * Flag to indicate that the next update will have a selection state
   * This is set by operations like indentSelection before they modify the graph
   */
  nextUpdateHasSelectionState: boolean = false;

  /**
   * The ID of the last transaction that was created
   * Used to associate selection states with their transactions
   */
  lastTransactionId: string | null = null;

  @observable.shallow
  private undoStack: TransactionObject[] = [];
  @observable.shallow
  private redoStack: TransactionObject[] = [];

  syncQueue: SyncData[] = [];

  private authedFetch?: typeof fetch;

  @observable
  offlineSince: Date | null = null;
  @observable
  lastSuccessfulSync: Date = new Date();

  private refetchCallback: (data: SerializedGraphStore) => void;
  private applyGraphUpdates: (updates: GraphUpdate[]) => void;
  private removeFromDeletedNodes: (nodeId: string) => void;
  private removeFromDeletedRelations: (relationId: string) => void;

  static incrementSyncCount(entityId: string): void {
    if (!UpdateManager.pendingNodeSyncCounts.has(entityId) && UpdateManager.pendingNodeSyncCounts.size >= MAX_PENDING_SYNC_ENTITIES) {
      const oldest = UpdateManager.pendingNodeSyncCounts.keys().next().value;
      if (oldest) UpdateManager.pendingNodeSyncCounts.delete(oldest);
    }
    const currentCount = UpdateManager.pendingNodeSyncCounts.get(entityId) || 0;
    UpdateManager.pendingNodeSyncCounts.set(entityId, currentCount + 1);
  }

  static decrementSyncCount(entityId: string): void {
    const currentCount = UpdateManager.pendingNodeSyncCounts.get(entityId) || 1;
    if (currentCount - 1 <= 0) {
      UpdateManager.pendingNodeSyncCounts.delete(entityId);
    } else {
      UpdateManager.pendingNodeSyncCounts.set(entityId, currentCount - 1);
    }
  }

  static isSyncing(nodeId: string): boolean {
    return (UpdateManager.pendingNodeSyncCounts.get(nodeId) || 0) > 0;
  }

  constructor(
    userId: string,
    refetchCallback: (data: SerializedGraphStore) => void,
    applyUpdatesFn: (updates: GraphUpdate[]) => void,
    removeFromDeletedNodes: (nodeId: string) => void,
    removeFromDeletedRelations: (relationId: string) => void,
    // When undefined, the manager will not sync with the server
    authedFetch?: typeof fetch,
  ) {
    this.userId = userId;
    this.authedFetch = authedFetch;
    this.refetchCallback = refetchCallback;
    this.applyGraphUpdates = applyUpdatesFn;
    this.removeFromDeletedNodes = removeFromDeletedNodes;
    this.removeFromDeletedRelations = removeFromDeletedRelations;
    makeObservable(this);
  }

  /**
   * Get all updates in the current session's history.
   */
  @computed
  get sessionUpdates() {
    return this.undoStack.map((transaction) => transaction.updates);
  }

  // TODO not sure about these
  startSync() {
    if (!env.isPersistenceEnabled) return () => {};
    this.isSyncing = true;

    // Periodically send local updates to the server
    this.syncLoop();

    return () => {
      this.stopSync();
    };
  }

  private syncLoop() {
    if (!this.isSyncing) return;
    this.nextSyncId = setTimeout(async () => {
      if (!this.authedFetch) return;
      await this.syncLocalUpdates(this.authedFetch);
      this.syncLoop();
    }, 500);
  }

  stopSync() {
    clearTimeout(this.nextSyncId);
    this.isSyncing = false;
  }

  get syncRunning() {
    return this.isSyncing;
  }

  private async fetchLatestDataSnapshot() {
    if (!this.authedFetch) throw new Error("Authenticated fetch is unavailable for snapshot recovery");
    const latestData = await fetchConvexSnapshot(this.authedFetch);
    this.refetchCallback(latestData);
    runInAction(() => {
      this.offlineSince = null;
      this.lastSuccessfulSync = new Date();
    });
  }

  async handleSyncData(data: SyncData, resetIfApplyFails: boolean) {
    try {
      this.applyGraphUpdates(data.updates);
    } catch (e) {
      const message = "Failed to apply updates from sync data";
      logger.warn(message, e);
      captureException(e, { extra: { message, syncData: data } });
      if (resetIfApplyFails) {
        await this.fetchLatestDataSnapshot();
      }
    }
  }

  private revertGraphUpdates(updates: GraphUpdate[]) {
    const inverted = generateInverseUpdates(updates);
    this.applyGraphUpdates(inverted);
  }

  /**
   * Checks if the update is a 'silent' update (e.g., link conversion or merge) by comparing content.
   *
   * This function compares both the text and formatting (styles) of each chip in the content array.
   * If any chip's formatting (e.g., bold/italic) changes, or if any chip's value changes, this returns false.
   *
   * This ensures that formatting changes (like bold/italic) and TODO checkbox state changes are treated as separate undo steps,
   * rather than being grouped with previous content changes. This fixes the bug where undoing a formatting or TODO change would also undo the previous content change, which is not the expected user behavior.
   *
   * For each chip type:
   *   - text: compares type, value, and styles (formatting)
   *   - image: compares type and url
   *   - mention: compares type and value
   *   - link: compares type, value, and url
   *   - linebreak: compares type and value
   *
   * Special case: If a chip changes from type 'text' to type 'link' (with the same value and url),
   * treat as a silent update (return true). This prevents undo from un-linkifying and re-linkifying strings,
   * which would cause rubber banding in the UI.
   */
  private isTextSame(updates: GraphUpdate[]) {
    // Only handle single updateNode operations
    if (updates.length !== 1 || updates[0].operation !== "updateNode") {
      return false;
    }
    // If the TODO checkbox state changed, treat as a separate undo step.
    if (updates[0].oldProps.isChecked !== updates[0].newProps.isChecked) {
      return false;
    }
    const oldContent = updates[0].oldProps.content;
    const newContent = updates[0].newProps.content;
    if (!Array.isArray(oldContent) || !Array.isArray(newContent) || oldContent.length !== newContent.length) {
      return false;
    }
    for (let i = 0; i < oldContent.length; i++) {
      const oldChip = oldContent[i];
      const newChip = newContent[i];
      // Special case: allow text->link conversion with same value/url as a silent update
      if (
        oldChip.type === "text" &&
        newChip.type === "link" &&
        oldChip.value === newChip.value &&
        newChip.url === newChip.value
      ) {
        continue;
      }
      // Compare type, value, and styles for text chips (handles bold/italic changes)
      if (
        oldChip.type !== newChip.type ||
        (oldChip.type === "text" && newChip.type === "text" && (
          oldChip.value !== newChip.value ||
          (oldChip.styles ?? 0) !== (newChip.styles ?? 0)
        ))
      ) {
        return false;
      }
      // For other chip types, compare their main properties
      if (oldChip.type === "image" && newChip.type === "image" && oldChip.url !== newChip.url) {
        return false;
      }
      if (oldChip.type === "mention" && newChip.type === "mention" && oldChip.value !== newChip.value) {
        return false;
      }
      if (oldChip.type === "link" && newChip.type === "link" && (oldChip.value !== newChip.value || oldChip.url !== newChip.url)) {
        return false;
      }
      if (oldChip.type === "linebreak" && newChip.type === "linebreak" && oldChip.value !== newChip.value) {
        return false;
      }
    }
    // If we reach here, all chips are either identical or text->link conversions
    return true;
  }

  /**
   * Queue updates to be undone/redone and synced with the server.
   *
   * @param updates The graph updates
   * @param hasSelectionState Whether this update has an associated selection state
   */
  queueUpdates(updates: GraphUpdate[], hasSelectionState: boolean = false) {
    // Generate a unique ID for this transaction
    const transactionId = uuid();
    this.lastTransactionId = transactionId;

    // Check if this update has been marked as having a selection state
    hasSelectionState = hasSelectionState || this.nextUpdateHasSelectionState;
    this.nextUpdateHasSelectionState = false; // Reset the flag

    // If the update is an updateNode link conversion, add it to the most recent element on the undoStack
    // because if not, then the undo will not work.
    if (this.undoStack.length > 0 && this.isTextSame(updates)) {
      this.undoStack[this.undoStack.length - 1].updates.push(updates[0]);
    } else {
      this.undoStack.push({
        updates,
        hasSelectionState,
        id: transactionId,
      });
    }

    this.redoStack = [];

    const dataForSync: SyncData = {
      clientId: this.clientId,
      userId: this.userId,
      transactionId,
      updates,
    };

    this.enqueueSync(dataForSync);

    // Return the transaction ID so it can be associated with a selection state
    return transactionId;
  }

  /**
   * Replays a previously reviewed, schema-validated transaction and records it
   * as one undoable/syncable action. Used by durable agent rollback receipts.
   */
  applyDurableTransaction(updates: GraphUpdate[]) {
    if (!updates.length) throw new Error("A durable transaction must contain at least one update");
    if (updates.length > 500) throw new Error("A durable transaction cannot exceed 500 updates");
    this.applyGraphUpdates(updates);
    return this.queueUpdates(updates);
  }

  undo() {
    const transaction = this.undoStack.pop();
    if (!transaction) {
      return;
    }

    const updates = transaction.updates;
    this.redoStack.push(transaction);

    // The "undo" operation actually creates a new action rather than directly reverting the original changes.
    // This is so that the changes from undo can be synced with backend.
    const inverted = generateInverseUpdates(updates);
    inverted.forEach((update) => {
      if (update.operation === "addNode") {
        this.removeFromDeletedNodes(update.node.id);
      }
      if (update.operation === "addRelation") {
        this.removeFromDeletedRelations(update.relation.id);
      }
    });
    this.applyGraphUpdates(inverted);

    const dataForSync: SyncData = {
      clientId: this.clientId,
      userId: this.userId,
      transactionId: uuid(),
      updates: inverted,
    };
    this.enqueueSync(dataForSync);

    // After undo is complete, try to restore the appropriate selection state if this transaction has one
    if (transaction.hasSelectionState) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("restore-selection-state", {
            detail: { transactionId: transaction.id },
          }),
        );
      }
    }
  }

  redo() {
    const transaction = this.redoStack.pop();
    if (!transaction) {
      return;
    }

    const updates = transaction.updates;
    this.undoStack.push(transaction);
    this.applyGraphUpdates(updates);

    const dataForSync: SyncData = {
      clientId: this.clientId,
      userId: this.userId,
      transactionId: uuid(),
      updates,
    };
    this.enqueueSync(dataForSync);
  }

  private async sendChunkedSyncData(syncData: SyncData) {
    if (!this.authedFetch) return;
    // implements the following:
    // - throws "size" error on rows larger than maxRows
    // - chunks the updates into chunks of maxChunkSize
    const maxRows = 500;
    const maxChunkSize = 2000;
    const updatesLength = syncData.updates.length;
    if (updatesLength > maxRows) {
      throw new Error(`Sync data exceeds maximum number of rows: ${updatesLength}`);
    }

    const chunks = [];
    for (let i = 0; i < updatesLength; i += maxChunkSize) {
      const chunk = syncData.updates.slice(i, i + maxChunkSize);
      chunks.push(chunk);
    }

    for (const chunk of chunks) {
      const chunkSyncData: SyncData = {
        clientId: syncData.clientId,
        userId: syncData.userId,
        transactionId: syncData.transactionId,
        updates: chunk,
      };
      const resp = await this.authedFetch("/api/sync/import-chunk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunkSyncData),
      });
      if (!resp.ok) {
        console.error("Sync update failed");
        this.fetchLatestDataSnapshot();
      }
    }
  }

  async syncImportUpdates(updates: GraphUpdate[]) {
    if (!this.authedFetch) return;
    const supportedTypes = ["addNode", "addRelation", "addRelationType"];

    // log a warning if updates contains an unsupported type
    const unsupported = updates
      .filter((update) => !supportedTypes.includes(update.operation))
      .map((update) => update.operation);

    if (unsupported.length > 0) {
      console.warn("Unsupported update type(s) in sync:", ...new Set(unsupported));
    }

    // Send the data by supported type over to be chunked and sent to the server
    for (const type of supportedTypes) {
      const curUpdates = updates.filter((update) => update.operation === type);
      if (curUpdates.length > 0) {
        const typeBatch: SyncData = {
          clientId: this.clientId,
          userId: this.userId,
          transactionId: uuid(),
          updates: curUpdates,
        };
        await this.sendChunkedSyncData(typeBatch);
      }
    }
  }

  async syncLocalUpdates(userFetch: typeof fetch) {
    if (!this.syncQueue.length) {
      return;
    }

    const syncDataBatch = condenseSyncDataBatch(this.syncQueue);

    this.syncQueue = [];
    let syncData = syncDataBatch.shift();
    try {
      while (syncData) {
        const outgoingEntityIds = getEntityIdsFromUpdates(syncData);
        outgoingEntityIds.forEach((id) => UpdateManager.incrementSyncCount(id));

        logger.debug("Sending sync data", syncData);
        const chunkedNodeUpdate = this.requiresChunkedNodeUpdate(syncData);

        let response: Response = { ok: false } as any;
        let tries = 0;
        while (!response.ok) {
          if (chunkedNodeUpdate) {
            response = await this.sendChunkedNodeUpdate(syncData, userFetch);
          } else {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort("Sync request timed out"), SYNC_REQUEST_TIMEOUT_MS);
            try {
              response = await userFetch("/api/sync", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(syncData),
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeout);
            }
          }
          tries++;
          if (tries > 3) {
            break;
          }
        }

        if (!response.ok) {
          logger.error("Sync failed", response);
          // Revert all pending updates and the current task, moving backwards to ensure that the state is consistent.
          let lastTask = syncDataBatch.pop();
          while (lastTask) {
            this.revertGraphUpdates(lastTask.updates);
            lastTask = syncDataBatch.pop();
          }
          this.revertGraphUpdates(syncData.updates);
          // Fetch all data from the server to get back to a consistent state.
          await this.fetchLatestDataSnapshot();
          return;
        }
        const settledEntityIds = getEntityIdsFromUpdates(syncData);
        settledEntityIds.forEach((id) => UpdateManager.decrementSyncCount(id));
        syncData = syncDataBatch.shift();
      }
    } catch (e) {
      logger.error("Failed to POST sync data to backend", e);
      this.syncQueue = syncData ? [syncData, ...syncDataBatch] : syncDataBatch;
      this.offlineSince = this.offlineSince || new Date();
      return;
    }
    runInAction(() => {
      this.offlineSince = null;
      this.lastSuccessfulSync = new Date();
    });
  }

  /**
   * Get updates that are pending to be sent to the server.
   */
  get pendingUpdates() {
    return this.syncQueue;
  }

  async acceptRemoteSync(raw: unknown) {
    const chunkedEvent = ChunkedNodeSyncEventSchema.safeParse(raw);
    if (chunkedEvent.success) {
      if (chunkedEvent.data.clientId !== this.clientId) await this.fetchLatestDataSnapshot();
      return;
    }
    const parsed = SyncDataSchema.safeParse(raw);
    if (!parsed.success || parsed.data.clientId === this.clientId) return;
    await this.handleSyncData(parsed.data, parsed.data.userId === this.userId);
  }

  private requiresChunkedNodeUpdate(syncData: SyncData) {
    if (syncData.updates.length !== 1 || syncData.updates[0].operation !== "updateNode") return false;
    const update = syncData.updates[0];
    const encoder = new TextEncoder();
    return encoder.encode(JSON.stringify(update.oldProps)).byteLength > MAX_INLINE_NODE_BYTES
      || encoder.encode(JSON.stringify(update.newProps)).byteLength > MAX_INLINE_NODE_BYTES;
  }

  private async postChunkedNodePhase(userFetch: typeof fetch, body: unknown) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("Chunked node sync timed out"), SYNC_REQUEST_TIMEOUT_MS);
    try {
      return await userFetch("/api/sync/chunked-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sendChunkedNodeUpdate(syncData: SyncData, userFetch: typeof fetch) {
    const update = syncData.updates[0];
    if (update.operation !== "updateNode") throw new Error("Chunked sync only supports node updates");
    const document = JSON.stringify(update.newProps);
    const chunks = splitUtf8(document);
    const metadata = {
      uploadId: `node:${syncData.transactionId}`,
      transactionId: syncData.transactionId,
      clientId: syncData.clientId,
      nodeId: update.newProps.id,
      expectedVersion: update.oldProps.version,
      targetVersion: update.newProps.version,
      oldEntityHash: await sha256(canonicalEntityForCas(update.oldProps)),
      newDocumentDigest: await sha256(document),
      chunkCount: chunks.length,
      totalBytes: new TextEncoder().encode(document).byteLength,
    };
    const metadataHash = await sha256(canonical(metadata));
    let response = await this.postChunkedNodePhase(userFetch, { phase: "start", ...metadata, metadataHash });
    if (!response.ok) return response;
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      response = await this.postChunkedNodePhase(userFetch, {
        phase: "part",
        uploadId: metadata.uploadId,
        chunkIndex,
        document: chunk,
        digest: await sha256(chunk),
      });
      if (!response.ok) return response;
    }
    return this.postChunkedNodePhase(userFetch, { phase: "finalize", uploadId: metadata.uploadId });
  }

  private enqueueSync(data: SyncData) {
    if (this.syncQueue.length >= MAX_SYNC_QUEUE_ITEMS) {
      throw new Error(`Sync queue exceeded its ${MAX_SYNC_QUEUE_ITEMS}-item capacity`);
    }
    this.syncQueue.push(data);
  }

  get numPendingUpdates() {
    return this.syncQueue.length;
  }

  /**
   * Undo all pending tasks in the queue, moving backwards to ensure that the state is consistent.
   */
  revertAllPending() {
    let task = this.syncQueue.pop();
    while (task) {
      this.revertGraphUpdates(task.updates);
      task = this.syncQueue.pop();
    }
  }

  /**
   * Clear all pending updates without sending them to the server or undoing them. Use carefully!
   */
  cleanup() {
    this.undoStack = [];
    this.redoStack = [];
    this.syncQueue = [];
  }
}
