import { PersistedGraphNodeSchema, PersistedGraphRelationSchema } from "@/db/schema";
import { z } from "zod";

export const PostGraphRequestSchema = z.union([
  z.object({
    type: z.literal("upsert"),
    nodes: z.optional(z.array(PersistedGraphNodeSchema)),
    relations: z.optional(z.array(PersistedGraphRelationSchema)),
  }),
  z.object({
    type: z.literal("delete"),
    nodes: z.optional(z.array(z.object({ id: z.string() }))),
    relations: z.optional(z.array(z.object({ id: z.string() }))),
  }),
]);

export type PostGraphRequest = z.infer<typeof PostGraphRequestSchema>;
export const PostGraphResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type PostGraphResponse = z.infer<typeof PostGraphResponseSchema>;
export const GetGraphResponseSchema = z.object({
  nodes: z.array(PersistedGraphNodeSchema),
  relations: z.array(PersistedGraphRelationSchema),
});
export type GetGraphResponse = z.infer<typeof GetGraphResponseSchema>;
