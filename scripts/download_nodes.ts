import fs from "fs";
import { env } from "process";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { graphNodeTable } from "@/db/schema";

async function downloadNodes() {
  const db = getDb(env.POSTGRES_CONNECTION_STRING);
  try {
    await db.transaction(async (tx) => {
      // get all nodes with id starting with "entity-"
      const nodes = await tx
        .select()
        .from(graphNodeTable)
        .where(sql`id LIKE 'ent-%'`);

      console.log(`Found ${nodes.length} nodes with id starting with "ent-"`);

      fs.writeFileSync("nodes.json", JSON.stringify(nodes));
    });
  } catch (error) {
    console.error("Error updating relation types:", error);
  }
}
downloadNodes();
