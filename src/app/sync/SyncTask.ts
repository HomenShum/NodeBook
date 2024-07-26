import { z } from "zod";

import { GraphUpdate, GraphUpdateSchema } from "@/app/graph/GraphUpdate";

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
