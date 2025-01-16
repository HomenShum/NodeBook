import { z } from "zod";

import {
  AddNodeSchema,
  AddRelationSchema,
  // AddRelationTypeSchema,
  GraphUpdate,
  GraphUpdateSchema,
  UpdateRelationListSchema,
} from "@/app/graph/GraphUpdate";
import { uuid } from "@/app/util";

export const SyncDataSchema = z.object({
  clientId: z.string(),
  userId: z.string(),
  transactionId: z.string(),
  updates: GraphUpdateSchema.array(),
});
export type SyncData = z.infer<typeof SyncDataSchema>;

export const ImportChunkDataSchema = z.object({
  clientId: z.string(),
  userId: z.string(),
  transactionId: z.string(),
  updates: z.union([
    AddNodeSchema.array(),
    AddRelationSchema.array(),
    // AddRelationTypeSchema.array(),
    UpdateRelationListSchema.array(),
  ]),
});

export type ImportChunkData = z.infer<typeof ImportChunkDataSchema>;

/**
 * Try to combine SyncTasks to reduce the number of requests sent to the server.
 */
export const condenseSyncDataBatch = (taskQueue: SyncData[]): SyncData[] => {
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
export const combineIfSequentialNodeUpdates = (taskA: SyncData, taskB: SyncData | undefined): SyncData | undefined => {
  if (
    !taskB ||
    taskA.clientId !== taskB.clientId ||
    taskA.userId !== taskB.userId ||
    taskA.updates.length !== 1 ||
    taskB.updates.length !== 1
  ) {
    return undefined;
  }
  const updateA = taskA.updates[0];
  const updateB = taskB.updates[0];
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
      clientId: taskA.clientId,
      userId: taskA.userId,
      transactionId: uuid(),
      updates: [newUpdate],
    };
  }
};
