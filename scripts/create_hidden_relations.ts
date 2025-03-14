import { like } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable } from "@/db/schema";
import { env } from "@/envBackend";

const AUTHOR_ID = "google-oauth2|113848062230650872986";
const ENTANGLEMENT_NODE_ID = "e8b9149c";

async function createHiddenRelations() {
  const db = getDb(env.POSTGRES_CONNECTION_STRING);

  try {
    await db.transaction(async (tx) => {
      console.log("Finding all ent- nodes...");

      // Get all nodes that start with "ent-"
      const entNodes = await tx
        .select({
          id: graphNodeTable.id,
        })
        .from(graphNodeTable)
        .where(like(graphNodeTable.id, "ent-%"));

      console.log(`Found ${entNodes.length} ent- nodes`);

      // Create dataSource relations from each ent- node to the entanglement node
      const relations = entNodes.map((node) => ({
        id: `ds-ent-${uuidv4()}`,
        version: 1,
        authorId: AUTHOR_ID,
        fromId: node.id,
        toId: ENTANGLEMENT_NODE_ID,
        relationTypeId: "dataSource",
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      console.log("Creating dataSource relations...");

      // Insert all relations
      // const result = await tx.insert(graphRelationTable).values(relations);

      // Batch sizes of 250
      const BATCH_SIZE = 50;
      for (let i = 0; i < relations.length; i += BATCH_SIZE) {
        const batch = relations.slice(i, i + BATCH_SIZE);
        await tx.insert(graphRelationTable).values(batch);
        console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(relations.length / BATCH_SIZE)}`);
      }

      console.log(`Created ${relations.length} dataSource relations`);
      console.log("Operation completed successfully");
    });
  } catch (error) {
    console.error("Error during relation creation:", error);
    throw error;
  }
}

// Run the script
createHiddenRelations()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
