import { z } from "zod";

import {
  DeletedRelationDataSchema,
  SerializedNodeSchema,
  SerializedPositionListSchema,
  SerializedRelationSchema,
  SerializedRelationTypeSchema,
} from "@/app/persistence/SerializedData";

const AddNodeSchema = z.object({
  operation: z.literal("addNode"),
  node: SerializedNodeSchema,
});
export type AddNode = z.infer<typeof AddNodeSchema>;

const UpdateNodeSchema = z.object({
  operation: z.literal("updateNode"),
  oldProps: SerializedNodeSchema,
  newProps: SerializedNodeSchema,
});
export type UpdateNode = z.infer<typeof UpdateNodeSchema>;

const DeleteNodeSchema = z.object({
  operation: z.literal("deleteNode"),
  node: SerializedNodeSchema,
});
export type DeleteNode = z.infer<typeof DeleteNodeSchema>;

const AddRelationTypeSchema = z.object({
  operation: z.literal("addRelationType"),
  relationType: SerializedRelationTypeSchema,
});
export type AddRelationType = z.infer<typeof AddRelationTypeSchema>;

const UpdateRelationTypeSchema = z.object({
  operation: z.literal("updateRelationType"),
  oldProps: SerializedRelationTypeSchema,
  newProps: SerializedRelationTypeSchema,
});
export type UpdateRelationType = z.infer<typeof UpdateRelationTypeSchema>;

const DeleteRelationTypeSchema = z.object({
  operation: z.literal("deleteRelationType"),
  relationType: SerializedRelationTypeSchema,
});
export type DeleteRelationType = z.infer<typeof DeleteRelationTypeSchema>;

const AddRelationSchema = z.object({
  operation: z.literal("addRelation"),
  relation: SerializedRelationSchema,
});
export type AddRelation = z.infer<typeof AddRelationSchema>;

const UpdateRelationSchema = z.object({
  operation: z.literal("updateRelation"),
  oldProps: SerializedRelationSchema,
  newProps: SerializedRelationSchema,
});
export type UpdateRelation = z.infer<typeof UpdateRelationSchema>;

const DeleteRelationSchema = z.object({
  operation: z.literal("deleteRelation"),
  deleted: DeletedRelationDataSchema,
});
export type DeleteRelation = z.infer<typeof DeleteRelationSchema>;

const UpdateRelationListSchema = z.object({
  operation: z.literal("updateRelationList"),
  authorId: z.string(),
  nodeId: z.string(),
  pinned: z.boolean(),
  listBefore: SerializedPositionListSchema,
  listAfter: SerializedPositionListSchema,
});
export type UpdateRelationList = z.infer<typeof UpdateRelationListSchema>;

export const GraphUpdateSchema = z.discriminatedUnion("operation", [
  AddNodeSchema,
  UpdateNodeSchema,
  DeleteNodeSchema,
  AddRelationTypeSchema,
  UpdateRelationTypeSchema,
  DeleteRelationTypeSchema,
  AddRelationSchema,
  UpdateRelationSchema,
  DeleteRelationSchema,
  UpdateRelationListSchema,
]);
export type GraphUpdate = z.infer<typeof GraphUpdateSchema>;
