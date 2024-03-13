import { getDb } from "@/db";
import { migrate } from "drizzle-orm/vercel-postgres/migrator";

async function main() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
}

main();
