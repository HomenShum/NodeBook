import { z } from "zod";

import { GroupId } from "@/app/tree/nodes";
import { Position } from "@/app/util";
import { GLOBAL_ADMIN_USER_ID } from "@/lib/constants";
import { CONNECTION_SYMBOL, MENTION_SYMBOL, PLUS_SYMBOL } from "@/lib/utils";

const SerializedChipSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    value: z.string(),
    styles: z.number().default(0).optional(),
  }),
  z.object({
    type: z.literal("mention"),
    value: z.string(),
    mentionTrigger: z.enum([MENTION_SYMBOL, CONNECTION_SYMBOL, PLUS_SYMBOL]).default(MENTION_SYMBOL).optional(),
  }),
  z.object({
    type: z.literal("linebreak"),
    value: z.string(),
  }),
  z.object({
    type: z.literal("link"),
    value: z.string(),
    url: z.string(),
  }),
]);

export const SerializedNodeSchema = z.object({
  id: z.string(),
  authorId: z.string().default(GLOBAL_ADMIN_USER_ID),
  version: z.number().default(1),
  createdAt: z.coerce.date().default(new Date()),
  updatedAt: z.coerce.date().default(new Date()),
  content: z.array(SerializedChipSchema).default([]),
  isPublic: z.boolean().default(false),
  isNewRelatedObjectsPublic: z.boolean().default(false),
  canonicalRelationId: z.string().nullable().default(null),
  isChecked: z.boolean().nullable().default(null),
});
export type SerializedNode = z.infer<typeof SerializedNodeSchema>;

export const SerializedRelationTypeSchema = z.object({
  id: z.string(),
  authorId: z.string().default(GLOBAL_ADMIN_USER_ID),
  version: z.number().default(1),
  label: z.string(),
  reverseLabel: z.string(),
  isPublic: z.boolean().default(false),
});

export const PositionSchema = z.object({
  int: z.number(),
  frac: z.string(),
});
export type SerializedPosition = z.infer<typeof PositionSchema>;

export const SerializedRelationSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  relationTypeId: z.string(),
  version: z.number().default(1),
  authorId: z.string().default(GLOBAL_ADMIN_USER_ID),
  createdAt: z.coerce.date().default(new Date()),
  updatedAt: z.coerce.date().default(new Date()),
  isPublic: z.boolean().default(false),
  canonicalRelationId: z.string().nullable().default(null),
});
export type SerializedRelation = z.infer<typeof SerializedRelationSchema>;

export const SerializedPositionListSchema = z.record(z.string(), PositionSchema);
export type SerializedPositionList<T> = z.infer<typeof SerializedPositionListSchema>;

export type DeletedRelationData = {
  relation: SerializedRelation;
  fromPos?: Position;
  fromPinnedPos?: Position;
  fromNoteContentPos?: Position;
  toPos?: Position;
  toPinnedPos?: Position;
  toNoteContentPos?: Position;
  relationsList: DeletedRelationData[];
};

export type DeletedRelationDataInput = {
  relation: z.input<typeof SerializedRelationSchema>;
  fromPos: z.input<typeof PositionSchema>;
  fromPinnedPos?: z.input<typeof PositionSchema>;
  fromNoteContentPos?: z.input<typeof PositionSchema>;
  toPos: z.input<typeof PositionSchema>;
  toPinnedPos?: z.input<typeof PositionSchema>;
  toNoteContentPos?: z.input<typeof PositionSchema>;
  relationsList: DeletedRelationDataInput[];
};

// Have to use z.ZodType and z.lazy because of recursive typing
// https://zod.dev/?id=recursive-types
export const DeletedRelationDataSchema: z.ZodType<DeletedRelationData, z.ZodTypeDef, DeletedRelationDataInput> =
  z.object({
    relation: SerializedRelationSchema,
    fromPos: PositionSchema,
    fromPinnedPos: PositionSchema.optional(),
    fromNoteContentPos: PositionSchema.optional(),
    toPos: PositionSchema,
    toPinnedPos: PositionSchema.optional(),
    toNoteContentPos: PositionSchema.optional(),
    relationsList: z.lazy(() => DeletedRelationDataSchema.array()),
  });

export const MewUserPublicSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
});

export type MewUserPublic = z.infer<typeof MewUserPublicSchema>;

export const SerializedGraphStoreSchema = z.object({
  userId: z.string().optional(),
  usersById: z.record(MewUserPublicSchema).default({}),
  nodesById: z.record(SerializedNodeSchema).default({}),
  relationTypesById: z.record(SerializedRelationTypeSchema).default({}),
  relationsById: z.record(SerializedRelationSchema).default({}),
  relationsByNodeId: z.record(z.record(PositionSchema)).default({}),
  pinnedRelationsByNodeId: z.record(z.record(PositionSchema)).default({}),
  noteContentRelationsByNodeId: z.record(z.record(PositionSchema)).default({}),
});
export type SerializedGraphStore = z.infer<typeof SerializedGraphStoreSchema>;

export type SerializedTree = {
  id: string;
  rootObjectId: string;
  pathToRootIds: { relationId: string; childGroupId: GroupId }[];
  expansionsByPath: Record<string, boolean>;
};

export type SerializedViewStore = {
  mainView: SerializedTree;
};

export type SerializedStores = {
  graphStore: SerializedGraphStore;
  viewStore: SerializedViewStore;
};
