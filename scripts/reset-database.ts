import { sql } from "drizzle-orm";

import { end, getDb } from "@/db";
import { env } from "@/envBackend";

async function main() {
  if (env.STAGE !== "development") {
    throw new Error(`This script can only be run in development. Current stage: ${env.STAGE}`);
  }
  const db = getDb(env.POSTGRES_CONNECTION_STRING);
  try {
    await db.execute(sql`
    DROP SCHEMA public CASCADE;
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    CREATE SCHEMA public;
  `);
    console.log("Successfully reset the database");
  } catch (error) {
    console.error("Error deleting data:", error);
  } finally {
    // Close the database connection
    await end();
  }
}

main();
