import readline from "readline";

import { migrate } from "drizzle-orm/vercel-postgres/migrator";

import { getDb } from "@/db";
import { env } from "@/envBackend";

async function main() {
  const connectionString = env.POSTGRES_CONNECTION_STRING;
  const dbName = new URL(connectionString).pathname.slice(1);

  console.log(`You're about to migrate the database: ${dbName}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Do you want to proceed with the migration? (y/n): ", async (answer) => {
    if (answer.toLowerCase() === "y") {
      console.log("Starting migration...");
      await migrate(getDb(connectionString), { migrationsFolder: "./drizzle" });
      console.log("Migration completed successfully.");
    } else {
      console.log("Migration cancelled.");
    }
    rl.close();
  });
}

main();
