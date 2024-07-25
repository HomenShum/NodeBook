import { GraphUpdate } from "@/app/graph/GraphUpdate";
import { SyncTask } from "@/app/sync/SyncTask";
import { uuid } from "@/app/util";

export class SyncQueue {
  private queue: SyncTask[] = [];
  private localTransactions: Set<string> = new Set();

  addUpdates(updates: GraphUpdate[], undoFn: () => void) {
    const task: SyncTask = {
      data: {
        transactionId: uuid(),
        updates,
      },
      undo: undoFn,
    };
    this.localTransactions.add(task.data.transactionId);
    this.queue.push(task);
  }

  isLocalTransaction(transactionId: string) {
    return this.localTransactions.has(transactionId);
  }

  async process(authFetch: typeof fetch) {
    let task = this.queue.shift();
    while (task) {
      const response = await authFetch(`/api/sync?userId=${window.mew.graphStore.user.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(task.data),
      });
      const responseJson = await response.json();
      if (responseJson.status !== "ok") {
        console.error("Sync failed", responseJson);
        this.undoAllPending();
        task.undo();
      }

      task = this.queue.shift();
    }
  }

  /**
   * Undo all pending tasks in the queue, moving backwards to ensure that the state is consistent.
   */
  undoAllPending() {
    // TODO: This maybe ends up being a place where we revert to a snapshot of server state rather than manually undoing things ourselves
    let task = this.queue.pop();
    while (task) {
      task.undo();
      task = this.queue.pop();
    }
  }

  /**
   * Get updates that are pending to be sent to the server.
   */
  get pendingUpdates() {
    return this.queue.map((task) => task.data);
  }

  /**
   * Clear all pending updates without sending them to the server or undoing them. Use carefully!
   */
  clear() {
    this.queue = [];
  }
}
