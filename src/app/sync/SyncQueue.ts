import { GraphUpdate } from "@/app/graph/GraphUpdate";
import { condenseSyncTasks, SyncTask } from "@/app/sync/SyncTask";
import { uuid } from "@/app/util";

export class SyncQueue {
  private userId: string;
  private queue: SyncTask[] = [];
  private localTransactions: Set<string> = new Set();

  private refetchAllData: () => Promise<void>;

  constructor(userId: string, refetchFn: () => Promise<void>) {
    this.userId = userId;
    this.refetchAllData = refetchFn;
  }

  addUpdates(updates: GraphUpdate[], undoFn: () => void) {
    const task: SyncTask = {
      data: {
        userId: this.userId,
        transactionId: uuid(),
        updates,
      },
      undo: undoFn,
    };
    this.queue.push(task);
  }

  isLocalTransaction(transactionId: string) {
    return this.localTransactions.has(transactionId);
  }

  async process(authFetch: typeof fetch) {
    const tasks = condenseSyncTasks(this.queue);
    this.queue = [];
    let task = tasks.shift();
    while (task) {
      this.localTransactions.add(task.data.transactionId);
      const response = await authFetch(`/api/sync?userId=${this.userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(task.data),
      });
      if (!response.ok) {
        console.error("Sync failed", response);
        // Revert all pending updates and the current task, moving backwards to ensure that the state is consistent.
        let lastTask = tasks.pop();
        while (lastTask) {
          lastTask.undo();
          lastTask = tasks.pop();
        }
        task.undo();
        // Fetch all data from the server to get back to a consistent state.
        await this.refetchAllData();
        return;
      }
      task = tasks.shift();
    }
  }

  /**
   * Get updates that are pending to be sent to the server.
   */
  get pendingUpdates() {
    return this.queue.map((task) => task.data);
  }

  /**
   * Undo all pending tasks in the queue, moving backwards to ensure that the state is consistent.
   */
  undoAllPending() {
    let task = this.queue.pop();
    while (task) {
      task.undo();
      task = this.queue.pop();
    }
  }

  /**
   * Clear all pending updates without sending them to the server or undoing them. Use carefully!
   */
  clear() {
    this.queue = [];
  }
}
