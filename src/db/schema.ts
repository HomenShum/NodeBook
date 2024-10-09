import { bigint, boolean, integer, pgTable, serial, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const dataTable = pgTable("data", {
  id: serial("id").primaryKey(),
  json: text("json"),
});
export const PersistedDataSchema = createSelectSchema(dataTable);
export type PersistedData = z.infer<typeof PersistedDataSchema>;

export const SearchAndReplaceDropdownOptionEnum = z.enum(["Always", "LabelledOnly", "SemicolonOnly"]);
export type SearchAndReplaceDropdownOption = z.infer<typeof SearchAndReplaceDropdownOptionEnum>;

const SerializedUserSettingsSchema = z.object({
  addAllNewNodesAsChildrenOfUserNode: z.boolean().optional(),
  showNodeDetails: z.boolean().optional(),
  hideDirectParent: z.boolean().optional(),
  hideAllRootParents: z.boolean().optional(),
  hideAllParents: z.boolean().optional(),
  hideBackrelations: z.boolean().optional(),
  hideBundles: z.boolean().optional(),
  hideZones: z.boolean().optional(),
  hideThoughtstreamBullets: z.boolean().optional(),
  hideBulletBackgroundIfParentsOnly: z.boolean().optional(),
  searchAndReplaceEnabled: z.boolean().optional(),
  searchAndReplaceDropdown: SearchAndReplaceDropdownOptionEnum.optional(),
  disableCycles: z.boolean().optional(),
  allowShiftTabAboveViewRoot: z.boolean().optional(),
  hidePinnedItems: z.boolean().optional(),
  publicMode: z.boolean().optional(),
  triggerRelationOnSingleColon: z.boolean().optional(),
});
export type SerializedUserSettings = z.infer<typeof SerializedUserSettingsSchema>;

export const userTable = pgTable("mew_user", {
  id: text("id").primaryKey(),
  email: text("email"),
  name: text("name"),
  picture: text("picture"),
  createdAt: timestamp("created_at"),
  settings: text("settings").default("{}").notNull(),
});
export const UserSchema = createSelectSchema(userTable, {
  createdAt: z.coerce.date(),
  settings: SerializedUserSettingsSchema,
});
export type PersistedUser = z.infer<typeof UserSchema>;

export const graphNodeTable = pgTable(
  "graph_node",
  {
    pk: uuid("pk").primaryKey().defaultRandom(),
    id: text("id").notNull(),
    version: integer("version").notNull().default(1),
    authorId: text("author_id").notNull(),
    createdAt: timestamp("created_at"),
    content: text("content"),
    isBundle: boolean("is_bundle"),
    isZone: boolean("is_zone"),
    isPublic: boolean("is_public").default(false),
    isNewRelatedObjectsPublic: boolean("is_new_related_objects_public").default(false),
  },
  (t) => ({
    unique: unique().on(t.id, t.authorId),
  }),
);
export const GraphNodeSchema = createSelectSchema(graphNodeTable);
export type PersistedGraphNode = z.infer<typeof GraphNodeSchema>;

export const graphRelationTable = pgTable(
  "graph_relation",
  {
    pk: uuid("pk").primaryKey().defaultRandom(),
    id: text("id").notNull(),
    version: integer("version").notNull().default(1),
    authorId: text("author_id").notNull(),
    createdAt: timestamp("created_at"),
    fromId: text("from_id"),
    toId: text("to_id"),
    relationTypeId: text("relation_type_id"),
    isPublic: boolean("is_public").default(false),
  },
  (t) => ({
    unique: unique().on(t.id, t.authorId),
  }),
);
export const GraphRelationSchema = createSelectSchema(graphRelationTable);
export type PersistedGraphRelation = z.infer<typeof GraphRelationSchema>;

export const relationTypeTable = pgTable(
  "relation_type",
  {
    pk: uuid("pk").primaryKey().defaultRandom(),
    id: text("id").notNull(),
    authorId: text("author_id").notNull(),
    version: integer("version").notNull().default(1),
    label: text("label"),
    reverseLabel: text("reverse_label"),
    isPublic: boolean("is_public").default(false),
  },
  (t) => ({
    unique: unique().on(t.id, t.authorId),
  }),
);
export const RelationTypeSchema = createSelectSchema(relationTypeTable);
export type PersistedRelationType = z.infer<typeof RelationTypeSchema>;

export const relationListsTable = pgTable(
  "relation_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id").notNull(),
    nodeId: text("node_id"),
    relationId: text("relation_id"),
    pinned: boolean("pinned"),
    positionInt: bigint("bigint", { mode: "number" }),
    positionFrac: text("position_frac"),
    isPublic: boolean("is_public").default(false),
  },
  (t) => ({
    unique: unique().on(t.nodeId, t.relationId, t.pinned),
  }),
);
export const RelationListsSchema = createSelectSchema(relationListsTable);
export type PersistedRelationLists = z.infer<typeof RelationListsSchema>;
