import { ExtractTablesWithRelations } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { VercelPgDatabase, VercelPgQueryResultHKT } from "drizzle-orm/vercel-postgres";

import * as schema from "./schema";

export type MewDatabase = VercelPgDatabase<typeof schema>;

export type MewDbSchema = typeof schema;

// Drizzle generates these kind of clunky generic types; the following alias is mainly just a readability aid
export type MewDbTransaction = PgTransaction<
  VercelPgQueryResultHKT,
  MewDbSchema,
  ExtractTablesWithRelations<MewDbSchema>
>;
