import { SerializedSyncData } from "@/app/persistence/SerializedData";
import { SyncTask } from "@/app/sync/SyncTask";

export class SyncQueue {
  private queue: SyncTask[] = [];

  add(task: SyncTask) {
    const { transaction, result } = task.dataToSync;
    // TODO: some more robust serialization logic for transactions?
    // Right now, only the positioner is ever a non-primitive value
    if (
      transaction.type === "addChildNode" &&
      transaction.transaction.after &&
      typeof transaction.transaction.after === "object"
    ) {
      transaction.transaction.after = transaction.transaction.after.id;
    }
    // Serialize the result data before adding it to the queue so that it's "frozen" before being sent to the server.
    // TODO: This is a bit of a hack; maybe do something better here or decide it's fine as-is.
    const serializedResult: SerializedSyncData = {
      nodes: result.nodes?.map((node) => node.serialize()),
      nodesDeleted: result.nodesDeleted?.map((node) => node.serialize()),
      relations: result.relations?.map((rel) => rel.serialize()),
      relationsDeleted: result.relationsDeleted?.map((rel) => rel.serialize()),
      relationLists: Object.fromEntries(
        Object.entries(result.relationLists ?? {}).map(([nodeId, relList]) => [nodeId, relList.serialize()]),
      ),
      pinnedRelationLists: Object.fromEntries(
        Object.entries(result.pinnedRelationLists ?? {}).map(([nodeId, relList]) => [nodeId, relList.serialize()]),
      ),
    };
    const taskForQueue = {
      ...task,
      dataToSync: {
        ...task.dataToSync,
        transaction,
        serializedResult,
      },
    };
    this.queue.push(taskForQueue);
  }

  async process() {
    let task = this.queue.shift();
    while (task) {
      const { transactionId, transaction, serializedResult } = task.dataToSync;
      console.log("Syncing", transactionId, transaction, serializedResult);
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transactionId, transaction, result: serializedResult }),
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
  private undoAllPending() {
    // TODO: This maybe ends up being a place where we revert to a snapshot of server state rather than manually undoing things ourselves
    let task = this.queue.pop();
    while (task) {
      task.undo();
      task = this.queue.pop();
    }
  }
}
