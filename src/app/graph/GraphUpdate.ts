import { z } from "zod";

import {
  DeletedRelationData,
  DeletedRelationDataSchema,
  PositionSchema,
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
  fromPos: PositionSchema.optional(),
  fromPinnedPos: PositionSchema.optional(),
  toPos: PositionSchema.optional(),
  toPinnedPos: PositionSchema.optional(),
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

// TODO: Figure out

export const generateInverseUpdates = (updates: GraphUpdate[]): GraphUpdate[] => {
  const inverseUpdates: GraphUpdate[] = [];

  for (const update of [...updates].reverse()) {
    switch (update.operation) {
      case "addNode":
        inverseUpdates.push({
          operation: "deleteNode",
          node: update.node,
        });
        break;

      case "updateNode":
        inverseUpdates.push({
          operation: "updateNode",
          oldProps: update.newProps,
          newProps: update.oldProps,
        });
        break;

      case "deleteNode":
        inverseUpdates.push({
          operation: "addNode",
          node: update.node,
        });
        break;

      case "addRelationType":
        inverseUpdates.push({
          operation: "deleteRelationType",
          relationType: update.relationType,
        });
        break;

      case "updateRelationType":
        inverseUpdates.push({
          operation: "updateRelationType",
          oldProps: update.newProps,
          newProps: update.oldProps,
        });
        break;

      case "deleteRelationType":
        inverseUpdates.push({
          operation: "addRelationType",
          relationType: update.relationType,
        });
        break;

      case "addRelation":
        inverseUpdates.push({
          operation: "deleteRelation",
          deleted: {
            relation: update.relation,
            fromPos: update.fromPos,
            fromPinnedPos: update.fromPinnedPos,
            toPos: update.toPos,
            toPinnedPos: update.toPinnedPos,
            relationsList: [],
            bundles: [],
          },
        });
        break;

      case "updateRelation":
        inverseUpdates.push({
          operation: "updateRelation",
          oldProps: update.newProps,
          newProps: update.oldProps,
        });
        break;

      case "deleteRelation":
        inverseUpdates.push(...invertDeleteRelationUpdate(update.deleted));
        break;

      case "updateRelationList":
        inverseUpdates.push({
          operation: "updateRelationList",
          authorId: update.authorId,
          nodeId: update.nodeId,
          pinned: update.pinned,
          listBefore: update.listAfter,
          listAfter: update.listBefore,
        });
        break;

      default:
        const _exhaustiveCheck: never = update;
    }
  }

  return inverseUpdates;
};

const invertDeleteRelationUpdate = (update: DeletedRelationData): AddRelation[] => {
  const inverse: AddRelation[] = [
    {
      operation: "addRelation",
      relation: update.relation,
      fromPos: update.fromPos,
      fromPinnedPos: update.fromPinnedPos,
      toPos: update.toPos,
      toPinnedPos: update.toPinnedPos,
    },
  ];
  for (const relation of update.relationsList) {
    inverse.push(...invertDeleteRelationUpdate(relation));
  }
  return inverse;
};
