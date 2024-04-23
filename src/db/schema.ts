import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const dataTable = pgTable("data", {
  id: serial("id").primaryKey(),
  json: text("json"),
});

export const PersistedDataSchema = createSelectSchema(dataTable);
export type PersitedData = z.infer<typeof PersistedDataSchema>;
