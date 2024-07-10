import { migrate } from "drizzle-orm/vercel-postgres/migrator";

import { getDb } from "@/db";

async function main() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
}

main();
