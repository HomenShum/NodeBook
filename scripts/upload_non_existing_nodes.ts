//@ts-nocheck
import fs from "fs";
import { env } from "process";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable } from "@/db/schema";

async function downloadNodes() {
  const db = getDb(env.POSTGRES_CONNECTION_STRING);
  const oldNodes = JSON.parse(fs.readFileSync("nodes.json", "utf8"));
  const oldNodesById = new Map<string, Object>(oldNodes.map((n) => [n.id, n]));
  try {
    await db.transaction(async (tx) => {
      // get all nodes with id starting with "entity-"
      const nodes = await tx
        .select()
        .from(graphNodeTable)
        .where(sql`id LIKE 'ent-%'`);

      const nodesById = new Map<string, Object>(nodes.map((n) => [n.id, n]));
      const deletedOldNodes = oldNodes.filter((n) => !nodesById.has(n.id));
      const deletedOldNodesIds = deletedOldNodes.map((n) => n.id);
      console.log(`Found ${deletedOldNodes.length} deleted old nodes`);

      const relations = await tx.select().from(graphRelationTable);

      const allFromAndToIds = new Set(relations.flatMap((r) => [r.fromId, r.toId]));
      const deletedNodesWithRelations = deletedOldNodes.filter((n) => allFromAndToIds.has(n.id));

      console.log(`Found ${deletedNodesWithRelations.length} deleted nodes with relations`);

      await tx.insert(graphNodeTable).values(
        deletedNodesWithRelations.map((n) => ({
          ...n,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          slug: null,
        })),
      );

      // // delete the deleted old nodes
      // await tx.delete(graphNodeTable).where(inArray(graphNodeTable.id, deletedOldNodes.map((n) => n.id)));

      // // upload the new nodes
      // await tx.insert(graphNodeTable).values(newNodes);
    });
  } catch (error) {
    console.error("Error updating relation types:", error);
  }
}
downloadNodes();
