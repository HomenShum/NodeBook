import readline from "readline";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/vercel-postgres/migrator";

import { end, getDb } from "@/db";
import { env } from "@/envBackend";

const PROD_DB_NAME = "verceldb";

async function main() {
  if (env.STAGE !== "development") {
    console.error(`This script can only be run in development. Current stage: ${env.STAGE}`);
    process.exit(1);
  }

  const connectionString = process.argv[2] || env.POSTGRES_CONNECTION_STRING;
  const dbName = new URL(connectionString).pathname.slice(1);

  if (dbName === PROD_DB_NAME) {
    console.error(`This script cannot be run on the production database. Current database: ${dbName}`);
    process.exit(1);
  }

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
