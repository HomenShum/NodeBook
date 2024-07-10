import { bigint, boolean, integer, pgTable, serial, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const dataTable = pgTable("data", {
  id: serial("id").primaryKey(),
  json: text("json"),
});

export const PersistedDataSchema = createSelectSchema(dataTable);
export type PersitedData = z.infer<typeof PersistedDataSchema>;

export const graphNodeTable = pgTable("graph_node", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at"),
  content: text("content"),
  isBundle: boolean("is_bundle"),
  isZone: boolean("is_zone"),
  isPrivate: boolean("is_private"),
});
export const GraphNodeSchema = createSelectSchema(graphNodeTable);
export type PersistedGraphNode = z.infer<typeof GraphNodeSchema>;

export const graphRelationTable = pgTable("graph_relation", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(1),
  fromId: text("from_id"),
  toId: text("to_id"),
  relationTypeId: text("relation_type_id"),
  isPrivate: boolean("is_private"),
});
export const GraphRelationSchema = createSelectSchema(graphRelationTable);
export type PersistedGraphRelation = z.infer<typeof GraphRelationSchema>;

export const relationTypeTable = pgTable("relation_type", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(1),
  label: text("label"),
  reverseLabel: text("reverseLabel"),
});
export const RelationTypeSchema = createSelectSchema(relationTypeTable);
export type PersistedRelationType = z.infer<typeof RelationTypeSchema>;

export const relationListsTable = pgTable(
  "relation_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nodeId: text("node_id"),
    relationId: text("relation_id"),
    pinned: boolean("pinned"),
    positionInt: bigint("bigint", { mode: "number" }),
    positionFrac: text("position_frac"),
  },
  (t) => ({
    unique: unique().on(t.nodeId, t.relationId, t.pinned),
  }),
);
export const RelationListsSchema = createSelectSchema(relationListsTable);
export type PersistedRelationLists = z.infer<typeof RelationListsSchema>;
