import { captureException } from "@sentry/nextjs";
import Pusher from "pusher-js";

import { env } from "@/app/envFrontend";
import { generateInverseUpdates, GraphUpdate } from "@/app/graph/GraphUpdate";
import { condenseSyncDataBatch, SyncData, SyncDataSchema } from "@/app/graph/SyncData";
import { SerializedGraphStore, SerializedGraphStoreSchema } from "@/app/persistence/SerializedData";
import { uuid } from "@/app/util";
import appLogger from "@/lib/logger";
import { GLOBAL_GRAPH_CHANNEL, userIdToPusherChannel } from "@/lib/pusher";

const logger = appLogger.child({ service: "UpdateManager" });

const pusher = new Pusher(env.pusherKey, { cluster: env.pusherCluster });

export class UpdateManager {
  private clientId = uuid();
  private userId: string;

  private isSyncing = false;
  private nextSyncId: ReturnType<typeof setTimeout> | number = 0;

  private undoStack: GraphUpdate[][] = [];
  private redoStack: GraphUpdate[][] = [];
  private syncQueue: SyncData[] = [];

  private authedFetch?: typeof fetch;

  private refetchCallback: (data: SerializedGraphStore) => void;
  private applyGraphUpdates: (updates: GraphUpdate[]) => void;

  constructor(
    userId: string,
    refetchCallback: (data: SerializedGraphStore) => void,
    applyUpdatesFn: (updates: GraphUpdate[]) => void,
    // When undefined, the manager will not sync with the server
    authedFetch?: typeof fetch,
  ) {
    this.userId = userId;
    this.authedFetch = authedFetch;
    this.refetchCallback = refetchCallback;
    this.applyGraphUpdates = applyUpdatesFn;
  }

  // TODO not sure about these
  startSync() {
    if (!env.isPersistenceEnabled) return () => {};
    this.isSyncing = true;

    // Subscribe to changes from other clients
    const userChannel = pusher.subscribe(userIdToPusherChannel(this.userId));
    userChannel.bind("transaction-accepted", (data: any) => {
      const parsedSyncData = SyncDataSchema.safeParse(data);
      if (!parsedSyncData.success) {
        console.error("Invalid sync data received", data);
        return;
      }
      if (parsedSyncData.data.clientId === this.clientId) {
        logger.debug("ignoring sync data from this client");
        return;
      }

      this.handleSyncData(parsedSyncData.data, true);
    });
    const globalChannel = pusher.subscribe(GLOBAL_GRAPH_CHANNEL);
    globalChannel.bind("transaction-accepted", (data: any) => {
      const parsedSyncData = SyncDataSchema.safeParse(data);
      if (!parsedSyncData.success) {
        console.error("Invalid sync data received", data);
        return;
      }
      if (parsedSyncData.data.userId === this.userId) {
        // We ignore because the same data will be received on the user's channel
        logger.debug("ignoring sync data from this user but different client.");
        return;
      }
      this.handleSyncData(parsedSyncData.data, false);
    });

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
    pusher.unsubscribe(userIdToPusherChannel(this.userId));
    pusher.unsubscribe(GLOBAL_GRAPH_CHANNEL);
    this.isSyncing = false;
  }

  get syncRunning() {
    return this.isSyncing;
  }

  private async fetchLatestDataSnapshot() {
    if (!this.authedFetch) return;
    logger.info("Fetching latest data snapshot from backend");
    const latestData = await this.authedFetch("/api/sync").then((res) => res.json());
    const parsed = SerializedGraphStoreSchema.safeParse(latestData.data);
    if (parsed.success) {
      this.refetchCallback(parsed.data);
    } else {
      logger.error("Failed to parse latest data snapshot", parsed.error);
    }
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

  private async sendChunkedSyncData(syncData: SyncData) {
    if (!this.authedFetch) return;
    // implements the following:
    // - throws "size" error on rows larger than maxRows
    // - chunks the updates into chunks of maxChunkSize
    const maxRows = 1000000;
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

  private async syncLocalUpdates(userFetch: typeof fetch) {
    const syncDataBatch = condenseSyncDataBatch(this.syncQueue);
    this.syncQueue = [];
    let syncData = syncDataBatch.shift();
    while (syncData) {
      logger.debug("sending sync data", syncData);
      let endpoint = "/api/sync";

      const response = await userFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(syncData),
      });

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
