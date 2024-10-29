import { z } from "zod";

import { Position } from "@/app/util";

const SerializedChipSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["text", "mention", "linebreak"]),
    value: z.string(),
  }),
  z.object({
    type: z.literal("link"),
    value: z.string(),
    url: z.string(),
  }),
]);

export const SerializedNodeSchema = z.object({
  version: z.number(),
  id: z.string(),
  authorId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  content: z.array(SerializedChipSchema),
  isPublic: z.boolean(),
  isNewRelatedObjectsPublic: z.boolean(),
  // sortOption: z.enum(["createdAt", "updatedAt", "alphabetical"]),
  // sortDirection: z.enum(["asc", "desc"]),
});
export type SerializedNode = z.infer<typeof SerializedNodeSchema>;

export const SerializedRelationTypeSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  version: z.number(),
  label: z.string(),
  reverseLabel: z.string(),
  isPublic: z.boolean(),
});

export const PositionSchema = z.object({
  int: z.number(),
  frac: z.string(),
});
export type SerializedPosition = z.infer<typeof PositionSchema>;

export const SerializedRelationSchema = z.object({
  version: z.number(),
  id: z.string(),
  authorId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  fromId: z.string(),
  toId: z.string(),
  relationTypeId: z.string(),
  isPublic: z.boolean(),
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
// Have to use z.ZodType and z.lazy because of recursive typing
// https://zod.dev/?id=recursive-types
export const DeletedRelationDataSchema: z.ZodType<DeletedRelationData> = z.object({
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
  usersById: z.record(MewUserPublicSchema),
  nodesById: z.record(SerializedNodeSchema),
  relationTypesById: z.record(SerializedRelationTypeSchema),
  relationsById: z.record(SerializedRelationSchema),
  relationsByNodeId: z.record(z.record(PositionSchema)),
  pinnedRelationsByNodeId: z.record(z.record(PositionSchema)),
  noteContentRelationsByNodeId: z.record(z.record(PositionSchema)),
});
export type SerializedGraphStore = z.infer<typeof SerializedGraphStoreSchema>;

export type SerializedTree = {
  id: string;
  rootObjectId: string;
  pathToRootIds: string[];
  expansionsByPath: Record<string, boolean>;
};

export type SerializedViewStore = {
  mainView: SerializedTree;
};

export type SerializedStores = {
  graphStore: SerializedGraphStore;
  viewStore: SerializedViewStore;
};
