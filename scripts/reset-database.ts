import readline from "readline";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/vercel-postgres/migrator";

import { end, getDb } from "@/db";
import { env } from "@/envBackend";

async function main() {
  if (env.STAGE !== "development") {
    throw new Error(`This script can only be run in development. Current stage: ${env.STAGE}`);
  }

  const connectionString = env.POSTGRES_CONNECTION_STRING;
  const dbName = new URL(connectionString).pathname.slice(1);

  console.log(`You're about to reset the database: ${dbName}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Do you want to proceed with resetting the database? (y/n): ", async (answer) => {
    if (answer.toLowerCase() === "y") {
      console.log("Starting database reset...");
      const db = getDb(connectionString);
      try {
        await db.execute(sql`
          DROP SCHEMA public CASCADE;
          DROP SCHEMA IF EXISTS drizzle CASCADE;
          CREATE SCHEMA public;
        `);
        await migrate(db, { migrationsFolder: "./drizzle" });
        console.log("Successfully reset the database");
      } catch (error) {
        console.error("Error resetting database:", error);
      } finally {
        await end();
      }
    } else {
      console.log("Database reset cancelled.");
    }
    rl.close();
  });
}

main();
