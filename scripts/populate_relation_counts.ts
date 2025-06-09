import { env } from "process";

import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres"; // Specific type for db

import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable } from "@/db/schema"; // Assuming graphRelationTable is here

async function updateNodeRelationCounts(db: NodePgDatabase<typeof import("@/db/schema")>) {
  console.log("Starting relation_count update for nodes in graph_node table.");

  // This single query is much more efficient than iterating through nodes in chunks.
  // It calculates the count of relations for each node and updates the graph_node table in one go.
  const query = sql`
    WITH node_relation_counts AS (
      SELECT
        node_id,
        COUNT(*) AS count
      FROM (
        SELECT from_id AS node_id FROM ${graphRelationTable} WHERE from_id IS NOT NULL
        UNION ALL
        SELECT to_id AS node_id FROM ${graphRelationTable} WHERE to_id IS NOT NULL
      ) all_relations
      GROUP BY node_id
    )
    UPDATE ${graphNodeTable}
    SET
      relation_count = COALESCE(nrc.count, 0)
    FROM (
      SELECT id FROM ${graphNodeTable}
    ) AS target_nodes
    LEFT JOIN node_relation_counts nrc ON target_nodes.id = nrc.node_id
    WHERE ${graphNodeTable}.id = target_nodes.id;
  `;

  const result = await db.execute(query);

  console.log(`Finished updating relation_count for nodes in graph_node table. Rows affected: ${result.rowCount}`);
}

async function updateRelationRelationCounts(db: NodePgDatabase<typeof import("@/db/schema")>) {
  console.log("Starting relation_count update for relations in graph_relation table.");

  // This single query is much more efficient than iterating through relations in chunks.
  // It calculates the count of relations pointing to each relation and updates the graph_relation table in one go.
  const query = sql`
    WITH relation_relation_counts AS (
      SELECT
        relation_id,
        COUNT(*) AS count
      FROM (
        SELECT from_id AS relation_id FROM ${graphRelationTable} WHERE from_id IS NOT NULL
        UNION ALL
        SELECT to_id AS relation_id FROM ${graphRelationTable} WHERE to_id IS NOT NULL
      ) all_referenced_ids
      GROUP BY relation_id
    )
    UPDATE ${graphRelationTable}
    SET
      relation_count = COALESCE(rrc.count, 0)
    FROM (
      SELECT id FROM ${graphRelationTable}
    ) AS target_relations
    LEFT JOIN relation_relation_counts rrc ON target_relations.id = rrc.relation_id
    WHERE ${graphRelationTable}.id = target_relations.id;
  `;

  const result = await db.execute(query);

  console.log(
    `Finished updating relation_count for relations in graph_relation table. Rows affected: ${result.rowCount}`,
  );
}

async function populateCounts() {
  if (!env.POSTGRES_CUSTOM_URL) {
    console.error("Error: POSTGRES_CONNECTION_STRING environment variable is not set.");
    process.exit(1);
  }
  const db = getDb(env.POSTGRES_CUSTOM_URL);
  try {
    console.log("Starting population of relation_count columns...");

    await updateNodeRelationCounts(db);
    await updateRelationRelationCounts(db);

    console.log("Successfully populated all relation_count columns.");
  } catch (error) {
    console.error("Error during relation_count population:", error);
    process.exit(1);
  } finally {
    // Assuming getDb doesn't return a connection that needs explicit closing here.
    // If it does, db.end() or similar should be called.
    console.log("Script finished.");
  }
}

populateCounts();
