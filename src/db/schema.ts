import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { ViewType } from "@/app/view/types";

export const dataTable = pgTable("data", {
  id: serial("id").primaryKey(),
  json: text("json"),
});

const tsvector = customType({
  dataType() {
    return "tsvector";
  },
});

export const PersistedDataSchema = createSelectSchema(dataTable);
export type PersistedData = z.infer<typeof PersistedDataSchema>;

export const SearchAndReplaceDropdownOptionEnum = z.enum(["Always", "LabelledOnly", "SemicolonOnly"]);
export type SearchAndReplaceDropdownOption = z.infer<typeof SearchAndReplaceDropdownOptionEnum>;

export const PasteLinksOptionEnum = z.enum(["Nothing", "PopulateAsChildren", "PopulateAsOrphanedNodes"]);
export type PasteLinksOption = z.infer<typeof PasteLinksOptionEnum>;

export const ParseWithAiLinkingOptionEnum = z.enum(["None", "LinkNodesInParse", "LinkNodesInGraph"]);
export type ParseWithAiLinkingOption = z.infer<typeof ParseWithAiLinkingOptionEnum>;

const SerializedUserSettingsSchema = z.object({
  addAllNewNodesAsChildrenOfUserNode: z.boolean().optional(),
  showNodeDetails: z.boolean().optional(),
  hideDirectParent: z.boolean().optional(),
  hideAllRootParents: z.boolean().optional(),
  hideAllParents: z.boolean().optional(),
  hideBackrelations: z.boolean().optional(),
  hideThoughtstreamBullets: z.boolean().optional(),
  hideBulletBackgroundIfParentsOnly: z.boolean().optional(),
  searchAndReplaceEnabled: z.boolean().optional(),
  searchAndReplaceDropdown: SearchAndReplaceDropdownOptionEnum.optional(),
  pasteLinksDropdown: PasteLinksOptionEnum.optional(),
  disableCycles: z.boolean().optional(),
  allowShiftTabAboveViewRoot: z.boolean().optional(),
  hidePinnedItems: z.boolean().optional(),
  publicMode: z.boolean().optional(),
  triggerRelationOnSingleColon: z.boolean().optional(),
  atHashtagReplacement: z.boolean().optional(),
  showIdeapadLinkButton: z.boolean().optional(),
  showExportSubtreeToIdeapad: z.boolean().optional(),
  showGraphViewButton: z.boolean().optional(),
  showGraphRoot: z.boolean().optional(),
  parseWithAiLinkingOption: ParseWithAiLinkingOptionEnum.optional(),
  showBulletForEmptyNode: z.boolean().optional(),
  showNotifications: z.boolean().optional(),
  useRoamResearchStyleMention: z.boolean().optional(),
  showOnlyTodos: z.boolean().optional(),
  showOnlyTodosInQuickCapture: z.boolean().optional(),
  todosFilterType: z.string().optional(),
  todosInQuickCaptureFilterType: z.string().optional(),
  showHiddenRelations: z.boolean().optional(),
  hideHashtagRelations: z.boolean().optional(),
  sidebarExpandedMyFavorites: z.boolean().optional(),
  sidebarExpandedMyHashtags: z.boolean().optional(),
  sidebarExpandedMyShortlinks: z.boolean().optional(),
  sidebarExpandedLocalHashtags: z.boolean().optional(),
  sidebarExpandedLocalMentions: z.boolean().optional(),
  viewModePreferences: z.record(z.nativeEnum(ViewType)).optional(),
});
export type SerializedUserSettings = z.infer<typeof SerializedUserSettingsSchema>;

export const userTable = pgTable("mew_user", {
  id: text("id").primaryKey(),
  username: text("username").default("").notNull(),
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
    updatedAt: timestamp("updated_at"),
    content: text("content"),
    contentText: text("content_text"),
    isPublic: boolean("is_public").default(false),
    isNewRelatedObjectsPublic: boolean("is_new_related_objects_public").default(false),
    canonicalRelationId: text("canonical_relation_id"),
    isChecked: boolean("is_checked"),
    relationCount: integer("relation_count").notNull().default(0),
    slug: text("slug"),
    contentTsvector: tsvector("content_tsvector"),
    accessMode: integer("access_mode").notNull().default(0),
    attributes: json().default({}).$type<Record<string, boolean | string | number | null>>(),
  },
  (t) => ({
    unique: unique().on(t.id, t.authorId),
    contentSearchIndex: index("content_search_index").using("gin", t.contentTsvector),
    contentSearchTrgmIndex: index("content_search_trgm_index").using("gin_trgm_ops", t.contentText),
    // contentSearchTrgmGistIndex: index("content_search_trgm_gist_index").using("gist_trgm_ops", t.contentText),
    authorIdIndex: index("author_id_index").on(t.authorId),
    isPublicIndex: index("is_public_index").on(t.isPublic),
    authorPublicCompositeIndex: index("author_public_index").on(t.authorId, t.isPublic),
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
    updatedAt: timestamp("updated_at"),
    fromId: text("from_id"),
    toId: text("to_id"),
    relationTypeId: text("relation_type_id"),
    relationCount: integer("relation_count").notNull().default(0),
    isPublic: boolean("is_public").default(false),
    canonicalRelationId: text("canonical_relation_id"),
  },
  (t) => ({
    unique: unique().on(t.id, t.authorId),
    authorIdIndex: index("relation_author_id_index").on(t.authorId),
    isPublicIndex: index("relation_is_public_index").on(t.isPublic),
    fromIdIndex: index("idx_graph_relation_from_id").on(t.fromId),
    toIdIndex: index("idx_graph_relation_to_id").on(t.toId),
    authorPublicCompositeIndex: index("relation_author_public_index").on(t.authorId, t.isPublic),
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

const relationListsTypeEnum = pgEnum("relation_lists_type", ["pinned", "noteContent", "all"]);

export const relationListsTable = pgTable(
  "relation_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id").notNull(),
    nodeId: text("node_id"),
    relationId: text("relation_id"),
    type: relationListsTypeEnum("type").notNull(),
    positionInt: bigint("position_int", { mode: "number" }),
    positionFrac: text("position_frac"),
    isPublic: boolean("is_public").default(false),
  },
  (t) => ({
    unique: unique().on(t.nodeId, t.relationId, t.type),
    authorRelationCompositeIndex: index("author_relation_index").on(t.authorId, t.relationId),
    publicRelationsIndex: index("public_relations_index").on(t.isPublic, t.relationId),
  }),
);
export const RelationListsSchema = createSelectSchema(relationListsTable);
export type PersistedRelationLists = z.infer<typeof RelationListsSchema>;

export type NotificationMessageContent = {
  mentionedById: string;
  nodeId: string;
};
export const notificationTable = pgTable("notification", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  messageContent: json("message_content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at"),
});
export const NotificationTableSchema = createSelectSchema(notificationTable);

export const expansionStateTable = pgTable(
  "expansion_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id").notNull(), // Who last saved the state
    rootObjectId: text("root_object_id").notNull(),
    expandedObjects: text("expanded_objects").notNull(), // JSON string array of tree node paths
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    unique: unique().on(t.rootObjectId), // Only unique on rootObjectId
  }),
);

export const ExpansionStateSchema = createSelectSchema(expansionStateTable);
export type PersistedExpansionState = z.infer<typeof ExpansionStateSchema>;
