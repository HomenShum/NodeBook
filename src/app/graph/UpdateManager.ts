import { generateInverseUpdates, GraphUpdate } from "@/app/graph/GraphUpdate";
import { condenseSyncDataBatch, SyncData } from "@/app/graph/SyncData";
import { uuid } from "@/app/util";

export class UpdateManager {
  private clientId = uuid();
  private userId: string;

  private undoStack: GraphUpdate[][] = [];
  private redoStack: GraphUpdate[][] = [];
  private syncQueue: SyncData[] = [];

  private refetchAllData: () => Promise<void>;
  private applyGraphUpdates: (updates: GraphUpdate[]) => void;

  constructor(userId: string, refetchFn: () => Promise<void>, applyUpdatesFn: (updates: GraphUpdate[]) => void) {
    this.userId = userId;
    this.refetchAllData = refetchFn;
    this.applyGraphUpdates = applyUpdatesFn;
  }

  revertGraphUpdates(updates: GraphUpdate[]) {
    const inverted = generateInverseUpdates(updates);
    this.applyGraphUpdates(inverted);
  }

  addUpdates(updates: GraphUpdate[]) {
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

  isLocalUpdate(syncData: SyncData) {
    return syncData.clientId === this.clientId;
  }

  async syncLocalUpdates(authFetch: typeof fetch) {
    const syncDataBatch = condenseSyncDataBatch(this.syncQueue);
    this.syncQueue = [];
    let syncData = syncDataBatch.shift();
    while (syncData) {
      const response = await authFetch(`/api/sync?userId=${this.userId}`, {
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
        await this.refetchAllData();
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
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.syncQueue = [];
  }
}
