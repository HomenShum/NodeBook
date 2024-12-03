import readline from "readline";

import { migrate } from "drizzle-orm/vercel-postgres/migrator";

import { getDb } from "@/db";
import { env } from "@/envBackend";

const connectionString = env.POSTGRES_CONNECTION_STRING;

async function migrateDb(answer: string) {
  if (answer.toLowerCase() === "y") {
    console.log("Starting migration...");
    await migrate(getDb(connectionString), { migrationsFolder: "./drizzle" });
    console.log("Migration completed successfully.");
  } else {
    console.log("Migration cancelled.");
  }
}

async function main() {
  const dbName = new URL(connectionString).pathname.slice(1);
  const skipConfirmation = process.argv.includes("-y");

  console.log(`You're about to migrate the database: ${dbName}`);

  if (skipConfirmation) {
    await migrateDb("y");
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Do you want to proceed with the migration? (y/n): ", async (answer) => {
      await migrateDb(answer);
      rl.close();
    });
  }
}

main();
