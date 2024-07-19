import { z } from "zod";

import { GraphUpdate, GraphUpdateSchema } from "@/app/graph/GraphUpdate";

export interface SyncData {
  transactionId: string;
  updates: GraphUpdate[];
}
export const SerializedSyncDataSchema = z.object({
  transactionId: z.string(),
  updates: GraphUpdateSchema.array(),
});

export interface SyncTask {
  data: SyncData;
  undo: () => void;
}
