import { pgTable, text } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const graphNodeTable = pgTable("graph_node", {
  id: text("id").primaryKey(),
  text: text("text").notNull().default(""),
  thoughtstreamPosition: text("thoughtstream_position"),
});

export const graphRelationTypeTable = pgTable("graph_relation_type", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  reverseLabel: text("reverse_label").notNull(),
});

export const graphRelationTable = pgTable("graph_relation", {
  id: text("id").primaryKey(),
  // TODO Add foreign key constraints. I had it before but it was causing issues. I think because
  // right now we submit nodes and relations in separate requests, so the node might not exist yet.
  fromId: text("from_id").notNull(),
  toId: text("to_id").notNull(),
  typeId: text("type_id")
    .notNull()
    .references(() => graphRelationTypeTable.id),
});

export const PersistedGraphNodeSchema = createSelectSchema(graphNodeTable);
export type PersistedGraphNode = z.infer<typeof PersistedGraphNodeSchema>;

export const PersistedGraphRelationTypeSchema = createSelectSchema(graphRelationTypeTable);
export type PersistedGraphRelationType = z.infer<typeof PersistedGraphRelationTypeSchema>;

export const PersistedGraphRelationSchema = createSelectSchema(graphRelationTable);
export type PersistedGraphRelation = z.infer<typeof PersistedGraphRelationSchema>;
