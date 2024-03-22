import { PersistedGraphNodeSchema, PersistedGraphRelationSchema, PersistedGraphRelationTypeSchema } from "@/db/schema";
import { z } from "zod";

export const PostGraphRequestSchema = z.union([
  z.object({
    type: z.literal("upsert"),
    nodes: z.optional(z.array(PersistedGraphNodeSchema)),
    relations: z.optional(z.array(PersistedGraphRelationSchema)),
    relationTypes: z.optional(z.array(PersistedGraphRelationTypeSchema)),
  }),
  z.object({
    type: z.literal("delete"),
    nodes: z.optional(z.array(z.object({ id: z.string() }))),
    relations: z.optional(z.array(z.object({ id: z.string() }))),
    relationTypes: z.optional(z.array(z.object({ id: z.string() }))),
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
  relationTypes: z.array(PersistedGraphRelationTypeSchema),
});
export type GetGraphResponse = z.infer<typeof GetGraphResponseSchema>;
