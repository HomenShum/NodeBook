import { z } from "zod";

import { ExtractedEntitySchema } from "@/app/api/extract-entities/ExtractEntitiesOpenAiResponse";

export const ExtractEntitiesRequestSchema = z.object({
  nodeText: z.string(),
});
export type ExtractEntitiesRequest = z.infer<typeof ExtractEntitiesRequestSchema>;

export const ExtractEntitiesResponseSchema = z.object({
  extractedEntities: z.array(ExtractedEntitySchema),
});
export type ExtractEntitiesResponse = z.infer<typeof ExtractEntitiesResponseSchema>;
