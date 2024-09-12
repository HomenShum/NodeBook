import { captureException } from "@sentry/nextjs";

import { generateInverseUpdates, GraphUpdate } from "@/app/graph/GraphUpdate";
import { condenseSyncDataBatch, SyncData } from "@/app/graph/SyncData";
import { SerializedGraphStore, SerializedGraphStoreSchema } from "@/app/persistence/SerializedData";
import { uuid } from "@/app/util";
import logger from "@/lib/logger";

export class UpdateManager {
  private clientId = uuid();
  private userId: string;

  private isSyncing = false;
  private nextSyncId: ReturnType<typeof setTimeout> | number = 0;

  private undoStack: GraphUpdate[][] = [];
  private redoStack: GraphUpdate[][] = [];
  private syncQueue: SyncData[] = [];

  private authedFetch: typeof fetch;

  private refetchCallback: (data: SerializedGraphStore) => void;
  private applyGraphUpdates: (updates: GraphUpdate[]) => void;

  constructor(
    userId: string,
    authedFetch: typeof fetch,
    refetchCallback: (data: SerializedGraphStore) => void,
    applyUpdatesFn: (updates: GraphUpdate[]) => void,
  ) {
    this.userId = userId;
    this.authedFetch = authedFetch;
    this.refetchCallback = refetchCallback;
    this.applyGraphUpdates = applyUpdatesFn;
  }

  // TODO not sure about these
  startSync() {
    this.isSyncing = true;
    this.syncLoop();
    return () => this.stopSync();
  }

  private syncLoop() {
    if (!this.isSyncing) return;
    this.nextSyncId = setTimeout(async () => {
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
    logger.info("Fetching latest data snapshot from backend");
    const latestData = await this.authedFetch("/api/sync").then((res) => res.json());
    const parsed = SerializedGraphStoreSchema.safeParse(latestData.data);
    if (parsed.success) {
      this.refetchCallback(parsed.data);
    } else {
      logger.error("Failed to parse latest data snapshot", parsed.error);
    }
  }

  async handleSyncData(data: SyncData) {
    if (this.isLocalUpdate(data)) {
      return;
    }

    try {
      this.applyGraphUpdates(data.updates);
    } catch (e) {
      const message = "Failed to apply updates from sync data";
      logger.warn(message, e);
      captureException(e, { extra: { message, syncData: data } });
      await this.fetchLatestDataSnapshot();
    }
  }

  private revertGraphUpdates(updates: GraphUpdate[]) {
    const inverted = generateInverseUpdates(updates);
    this.applyGraphUpdates(inverted);
  }

  queueUpdates(updates: GraphUpdate[]) {
    this.undoStack.push(updates);
    this.redoStack = [];
    const dataForSync: SyncData = {
      clientId: this.clientId,
      userId: this.userId,
      transactionId: uuid(),
      updates,
    };
    this.syncQueue.push(dataForSync);
  }

  undo() {
    const updates = this.undoStack.pop();
    if (!updates) {
      return;
    }
    this.redoStack.push(updates);

    // The "undo" operation actually creates a new action rather than directly reverting the original changes.
    // This is so that the changes from undo can be synced with backend.
    const inverted = generateInverseUpdates(updates);
    this.applyGraphUpdates(inverted);
    const dataForSync: SyncData = {
      clientId: this.clientId,
      userId: this.userId,
      transactionId: uuid(),
      updates: inverted,
    };
    this.syncQueue.push(dataForSync);
  }

  redo() {
    const updates = this.redoStack.pop();
    if (!updates) {
      return;
    }
    this.undoStack.push(updates);
    this.applyGraphUpdates(updates);
    const dataForSync: SyncData = {
      clientId: this.clientId,
      userId: this.userId,
      transactionId: uuid(),
      updates,
    };
    this.syncQueue.push(dataForSync);
  }

  private isLocalUpdate(syncData: SyncData) {
    return syncData.clientId === this.clientId;
  }

  private async syncLocalUpdates(authFetch: typeof fetch) {
    const syncDataBatch = condenseSyncDataBatch(this.syncQueue);
    this.syncQueue = [];
    let syncData = syncDataBatch.shift();
    while (syncData) {
      const response = await authFetch(`/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(syncData),
      });
      if (!response.ok) {
        console.error("Sync failed", response);
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
      syncData = syncDataBatch.shift();
    }
  }

  /**
   * Get updates that are pending to be sent to the server.
   */
  get pendingUpdates() {
    return this.syncQueue;
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
