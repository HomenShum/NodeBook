import { z } from "zod";

export const ExtractedEntitySchema = z.object({
  name: z.string(),
  relations: z.array(
    z.object({
      relation: z.string(),
      otherEntities: z.array(z.string()),
    }),
  ),
});
export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;

export const ExtractEntitiesOpenAiSchema = z.object({
  entities: z.array(ExtractedEntitySchema),
});
export type ExtractEntitiesOpenAiResponse = z.infer<typeof ExtractEntitiesOpenAiSchema>;
