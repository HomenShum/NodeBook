import { bigint, boolean, integer, pgTable, serial, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const dataTable = pgTable("data", {
  id: serial("id").primaryKey(),
  json: text("json"),
});

export const PersistedDataSchema = createSelectSchema(dataTable);
export type PersistedData = z.infer<typeof PersistedDataSchema>;

export const userTable = pgTable("mew_user", {
  id: text("id").primaryKey(),
  email: text("email"),
  name: text("name"),
  picture: text("picture"),
  createdAt: timestamp("created_at"),
});
export const UserSchema = createSelectSchema(userTable, {
  createdAt: z.coerce.date(),
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
    reverseLabel: text("reverseLabel"),
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
