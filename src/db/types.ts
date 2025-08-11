import { ExtractTablesWithRelations } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { NodePgDatabase, NodePgQueryResultHKT } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export type MewDatabase = NodePgDatabase<typeof schema>;

export type MewDbSchema = typeof schema;

// Drizzle generates these kind of clunky generic types; the following alias is mainly just a readability aid
export type MewDbTransaction = PgTransaction<
  NodePgQueryResultHKT,
  MewDbSchema,
  ExtractTablesWithRelations<MewDbSchema>
>;
