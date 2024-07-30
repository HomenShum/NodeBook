import { z } from "zod";

import { GraphUpdate, GraphUpdateSchema } from "@/app/graph/GraphUpdate";
import { uuid } from "@/app/util";

export interface SyncData {
  userId: string;
  transactionId: string;
  updates: GraphUpdate[];
}
export const SerializedSyncDataSchema = z.object({
  userId: z.string(),
  transactionId: z.string(),
  updates: GraphUpdateSchema.array(),
});

export interface SyncTask {
  data: SyncData;
  undo: () => void;
}

/**
 * Try to combine SyncTasks to reduce the number of requests sent to the server.
 */
export const condenseSyncTasks = (taskQueue: SyncTask[]): SyncTask[] => {
  const tasks = [...taskQueue];
  const condensed = [];
  let cur = tasks.shift();
  while (cur) {
    const next = tasks.shift();
    const combined = combineIfSequentialNodeUpdates(cur, next);
    if (combined) {
      cur = combined;
    } else {
      condensed.push(cur);
      cur = next;
    }
  }
  return condensed;
};

/**
 * Combine sequential node updates into a single SyncTask to reduce the number of requests sent to the server.
 *
 * The overwhelming majority of updates are single-node updates because we generate one on each keystroke. That makes
 * this is a good way to reduce the number of requests.
 */
export const combineIfSequentialNodeUpdates = (taskA: SyncTask, taskB: SyncTask | undefined): SyncTask | undefined => {
  if (!taskB || taskA.data.updates.length !== 1 || taskB.data.updates.length !== 1) {
    return undefined;
  }
  const updateA = taskA.data.updates[0];
  const updateB = taskB.data.updates[0];
  if (
    updateA.operation === "updateNode" &&
    updateB.operation === "updateNode" &&
    updateA.newProps.id === updateB.oldProps.id &&
    updateA.newProps.version === updateB.oldProps.version
  ) {
    const newUpdate: GraphUpdate = {
      operation: "updateNode",
      oldProps: updateA.oldProps,
      newProps: updateB.newProps,
    };
    return {
      data: {
        userId: taskA.data.userId,
        transactionId: uuid(),
        updates: [newUpdate],
      },
      undo: () => {
        taskB.undo();
        taskA.undo();
      },
    };
  }
};
