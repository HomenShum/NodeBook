import { z } from "zod";

export const ExtractEntitiesRequestSchema = z.object({
  nodeText: z.string(),
});
export type ExtractEntitiesRequest = z.infer<typeof ExtractEntitiesRequestSchema>;
