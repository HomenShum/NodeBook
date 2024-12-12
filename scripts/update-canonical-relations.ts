import { inArray, SQL, sql } from "drizzle-orm";

import { end, getDb } from "@/db";
import { graphNodeTable, graphRelationTable, PersistedGraphNode, PersistedGraphRelation } from "@/db/schema";
import { env } from "@/envBackend";
import {
  GLOBAL_ROOT_ID,
  GLOBAL_USERS_NODE_ID,
  GLOBAL_USERS_RELATION_ID,
  USERS_TO_USER_RELATION_ID_PREFIX,
} from "@/lib/constants";

const MAX_DEPTH = 20;
const BATCH_SIZE = 10_000;

/**
 * Updates canonical relations for all nodes and relations in the graph.
 *
 * It walks the graph starting from the global root, and assigns the canonical relation
 * for each object as the first relation that connects it to the global root.
 */
async function main() {
  try {
    console.log("Starting canonical relations update");
    const db = getDb(env.POSTGRES_CONNECTION_STRING);

    // Fetch all nodes and relations
    const nodes = await db.select().from(graphNodeTable);
    const relations = await db.select().from(graphRelationTable);

    const nodesById = new Map<string, PersistedGraphNode>(nodes.map((node) => [node.id, node]));
    const relationsById = new Map<string, PersistedGraphRelation>(relations.map((relation) => [relation.id, relation]));
    const relationsByObjectId = new Map<string, PersistedGraphRelation[]>();
    for (const relation of relations) {
      if (!relation.fromId || !relation.toId) continue;
      if (!relationsByObjectId.has(relation.fromId)) {
        relationsByObjectId.set(relation.fromId, []);
      }
      relationsByObjectId.get(relation.fromId)!.push(relation);
      if (!relationsByObjectId.has(relation.toId)) {
        relationsByObjectId.set(relation.toId, []);
      }
      relationsByObjectId.get(relation.toId)!.push(relation);
    }
    const canonicalRelationForNode = new Map<string, string | null>();
    const canonicalRelationForRelation = new Map<string, string | null>();

    // Assign global nodes canonical relation explicitly
    canonicalRelationForNode.set(GLOBAL_ROOT_ID, null);
    const globalRootToUsers = relations.find((r) => r.id === GLOBAL_USERS_RELATION_ID);
    const globalUsersNode = nodes.filter((n) => n.id === GLOBAL_USERS_NODE_ID);
    if (globalUsersNode && globalRootToUsers) {
      canonicalRelationForNode.set(GLOBAL_USERS_NODE_ID, globalRootToUsers.id);
    }

    // Assign user nodes canonical relations explicitly
    for (const relation of relations) {
      if (relation.id.startsWith(USERS_TO_USER_RELATION_ID_PREFIX)) {
        const globalUsersNodeId = relation.fromId;
        const userNodeId = relation.toId;
        if (globalUsersNodeId && userNodeId) {
          canonicalRelationForNode.set(userNodeId, relation.id);
        }
      }
    }

    // Assign canonical relations for all objects BFS from the global root
    const queue: Array<{ relationToParentId: string | null; objectId: string; depth: number }> = [
      { relationToParentId: null, objectId: GLOBAL_ROOT_ID, depth: 0 },
    ];
    const visited = new Set<string>([]);
    while (queue.length > 0) {
      const { relationToParentId, objectId, depth } = queue.shift()!;

      // Skip if visited or hit max depth
      if (depth >= MAX_DEPTH) continue;
      if (visited.has(objectId)) continue;

      // Set canonical relation for this object
      visited.add(objectId);
      if (relationToParentId) {
        if (relationsById.has(objectId) && !canonicalRelationForRelation.has(objectId)) {
          canonicalRelationForRelation.set(objectId, relationToParentId);
        } else if (nodesById.has(objectId) && !canonicalRelationForNode.has(objectId)) {
          canonicalRelationForNode.set(objectId, relationToParentId);
        }
      }

      // Queue neighbours
      for (const relation of relationsByObjectId.get(objectId) || []) {
        const otherObjectId = relation.fromId === objectId ? relation.toId! : relation.fromId!;
        queue.push({ relationToParentId: relation.id, objectId: otherObjectId, depth: depth + 1 });
      }
    }

    // Set null for unvisited nodes and relations
    for (const node of nodes) {
      if (!canonicalRelationForNode.has(node.id)) {
        canonicalRelationForNode.set(node.id, null);
      }
    }
    for (const relation of relations) {
      if (!canonicalRelationForRelation.has(relation.id)) {
        canonicalRelationForRelation.set(relation.id, null);
      }
    }

    // Update nodes in batches
    console.log(`Updating ${canonicalRelationForNode.size} canonical node relations`);
    for (let i = 0; i < canonicalRelationForNode.size; i += BATCH_SIZE) {
      const nodeUpdates = Array.from(canonicalRelationForNode.entries()).slice(i, i + BATCH_SIZE);
      if (nodeUpdates.length === 0) break;

      const sqlChunks: SQL[] = [];
      const ids: string[] = [];

      sqlChunks.push(sql`(case`);
      for (const [id, relationId] of nodeUpdates) {
        sqlChunks.push(sql`when ${graphNodeTable.id} = ${id} then ${relationId}`);
        ids.push(id);
      }
      sqlChunks.push(sql`end)`);

      const finalSql = sql.join(sqlChunks, sql.raw(" "));
      await db.update(graphNodeTable).set({ canonicalRelationId: finalSql }).where(inArray(graphNodeTable.id, ids));

      console.log(`Updated nodes batch ${i / BATCH_SIZE + 1}`);
    }

    // Update relations in batches
    console.log(`Updating ${canonicalRelationForRelation.size} canonical relation relations`);
    for (let i = 0; i < canonicalRelationForRelation.size; i += BATCH_SIZE) {
      const relationUpdates = Array.from(canonicalRelationForRelation.entries()).slice(i, i + BATCH_SIZE);
      if (relationUpdates.length === 0) break;

      const sqlChunks: SQL[] = [];
      const ids: string[] = [];

      sqlChunks.push(sql`(case`);
      for (const [id, relationId] of relationUpdates) {
        sqlChunks.push(sql`when ${graphRelationTable.id} = ${id} then ${relationId}`);
        ids.push(id);
      }
      sqlChunks.push(sql`end)`);

      const finalSql = sql.join(sqlChunks, sql.raw(" "));
      await db
        .update(graphRelationTable)
        .set({ canonicalRelationId: finalSql })
        .where(inArray(graphRelationTable.id, ids));

      console.log(`Updated relations batch ${i / BATCH_SIZE + 1}`);
    }

    console.log("Successfully updated canonical relations");
  } catch (error) {
    console.error("Error updating canonical relations:", error);
  } finally {
    await end();
  }
}

main();
