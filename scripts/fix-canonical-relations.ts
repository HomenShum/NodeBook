import fs from "fs";
import readline from "readline";

import { inArray, SQL, sql } from "drizzle-orm";

import { end, getDb } from "@/db";
import { graphNodeTable, graphRelationTable, PersistedGraphNode, PersistedGraphRelation } from "@/db/schema";
import { MewDatabase } from "@/db/types";
import { env } from "@/envBackend";
import { GLOBAL_ROOT_ID, USER_ROOT_ID_PREFIX, USERS_TO_USER_RELATION_ID_PREFIX } from "@/lib/constants";

type Object = PersistedGraphNode | PersistedGraphRelation;

const MAX_DEPTH = 20;
const BATCH_SIZE = 1000;

/**
 * A small helper to confirm user intention or exit the process.
 */
async function confirmUserAction(message: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question(message, (answer) => {
      if (answer.toLowerCase() !== "y") {
        console.log("Aborting...");
        process.exit(0);
      }
      rl.close();
      resolve();
    });
  });
}

async function getData(db: MewDatabase) {
  const nodes = await db.select().from(graphNodeTable);
  const relations = await db.select().from(graphRelationTable);
  const nodesById = new Map<string, PersistedGraphNode>(nodes.map((node) => [node.id, node]));
  const relationsById = new Map<string, PersistedGraphRelation>(relations.map((relation) => [relation.id, relation]));
  const getObjectById = (id: string) => nodesById.get(id) || relationsById.get(id);
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
  return { nodesById, relationsById, getObjectById, relationsByObjectId };
}

type Data = Awaited<ReturnType<typeof getData>>;

function getCanonicalPath(object: PersistedGraphNode | PersistedGraphRelation, data: Data) {
  const path: Array<{ relationToParent: PersistedGraphRelation | null; object: Object }> = [];

  let current: Object | null = object;
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) break;
    visited.add(current.id);

    const canonicalRelation: PersistedGraphRelation | null = current.canonicalRelationId
      ? data.relationsById.get(current.canonicalRelationId) ?? null
      : null;

    path.push({ relationToParent: canonicalRelation, object: current });

    if (current.id === GLOBAL_ROOT_ID) break;
    if (!canonicalRelation) break;

    const nextId: string =
      canonicalRelation.fromId === current.id ? canonicalRelation.toId! : canonicalRelation.fromId!;

    current = data.getObjectById(nextId) ?? null;
  }

  return path;
}

function getShortestsPaths(rootId: string, data: Data) {
  const canonicalRelationForObject = new Map<string, string | null>();
  const rootObject = data.getObjectById(rootId);
  if (!rootObject) return canonicalRelationForObject;
  const queue: Array<{
    validForAuthorId: string | "any";
    path: { parent: Object; relationToChild: PersistedGraphRelation }[];
    relationToParent: PersistedGraphRelation | null;
    object: Object;
    depth: number;
  }> = [];
  queue.push({ validForAuthorId: "any", path: [], relationToParent: null, object: rootObject, depth: 0 });
  const visited = new Set<string>([]);
  while (queue.length > 0) {
    const { validForAuthorId, path, relationToParent, object, depth } = queue.shift()!;

    // Skip if visited, hit max depth
    if (depth >= MAX_DEPTH) continue;
    if (visited.has(object.id)) continue;
    visited.add(object.id);

    // If this object doesn't have a valid canonical relation, set this path as canonical
    if (relationToParent && !canonicalRelationForObject.has(object.id)) {
      canonicalRelationForObject.set(object.id, relationToParent.id);
    }

    // As we walk a path of the graph, the next link in the chain is only valid if it has the same author
    // or if all previous links have been public
    function updateValidForAuthorId(currentAuthorId: string | "any", obj: Object): string | "any" | null {
      if (currentAuthorId === "any") {
        return obj.isPublic ? "any" : obj.authorId;
      }
      return obj.authorId === currentAuthorId ? obj.authorId : null;
    }

    // Queue neighbours
    for (const relation of data.relationsByObjectId.get(object.id) || []) {
      const otherObjectId = relation.fromId === object.id ? relation.toId! : relation.fromId!;
      const otherObject = data.getObjectById(otherObjectId);
      if (!otherObject) continue;

      // Check relation validity
      let nextValidForAuthorId = updateValidForAuthorId(validForAuthorId, relation);
      if (nextValidForAuthorId === null) continue;

      // Check other object validity
      nextValidForAuthorId = updateValidForAuthorId(nextValidForAuthorId, otherObject);
      if (nextValidForAuthorId === null) continue;

      queue.push({
        validForAuthorId: nextValidForAuthorId,
        path: [...path, { parent: object, relationToChild: relation }],
        relationToParent: relation,
        object: otherObject,
        depth: depth + 1,
      });
    }
  }
  return canonicalRelationForObject;
}

/**
 * Updates canonical relations for all nodes and relations in the graph.
 *
 * It walks the graph starting from the global root, and assigns the canonical relation
 * for each object as the first relation that connects it to the global root.
 */
async function main() {
  try {
    await confirmUserAction(`Database URL: ${env.POSTGRES_CONNECTION_STRING}\n\nAre you sure you want to proceed?`);

    type CanonicalRelationMethod =
      | "default"
      | "bfs-from-global-root"
      | "bfs-from-disconnected-root"
      | "disconnected-root";
    const canonicalRelationForObject = new Map<
      string,
      { method: CanonicalRelationMethod; relationId: string | null }
    >();
    const objectsWithInvalidCanonicalRelation = new Map<string, boolean>();
    const db = getDb(env.POSTGRES_CONNECTION_STRING);

    console.log("Fetching all graph data...");
    const data = await getData(db);

    console.log("Finding nodes with invalid canonical relations...");
    for (const object of [...data.nodesById.values(), ...data.relationsById.values()]) {
      const path = getCanonicalPath(object, data);
      // valid path is one where the entire chain of objects is either public or has the same author
      const visiblePath = path.every((p) => {
        const isVisibleRelation =
          p.relationToParent === null || p.relationToParent.isPublic || p.relationToParent.authorId === object.authorId;
        const isVisibleObject = p.object.isPublic || p.object.authorId === object.authorId;
        return isVisibleRelation && isVisibleObject;
      });
      const pathEndsAtGlobalRoot = path.length > 0 && path[path.length - 1].object.id === GLOBAL_ROOT_ID;
      objectsWithInvalidCanonicalRelation.set(object.id, !visiblePath || !pathEndsAtGlobalRoot);
    }
    const count = Array.from(objectsWithInvalidCanonicalRelation.values()).filter(Boolean).length;
    console.log(`Found ${count} objects with invalid canonical relations`);

    console.log("Identifying canonical relations for default nodes and relations...");
    for (const relation of data.relationsById.values()) {
      if (relation.id.startsWith(USERS_TO_USER_RELATION_ID_PREFIX)) {
        const globalUsersNodeId = relation.fromId;
        const userNodeId = relation.toId;
        if (globalUsersNodeId && userNodeId && objectsWithInvalidCanonicalRelation.get(userNodeId)) {
          canonicalRelationForObject.set(userNodeId, {
            method: "default",
            relationId: relation.id,
          });
        }
      }
    }
    for (const node of data.nodesById.values()) {
      if (node.id.startsWith(USER_ROOT_ID_PREFIX)) {
        for (const relation of data.relationsByObjectId.get(node.id) || []) {
          const childNodeId = relation.fromId === node.id ? relation.toId! : relation.fromId!;
          const childNode = data.nodesById.get(childNodeId);
          if (!childNode || childNode.authorId !== node.authorId) continue;
          if (!objectsWithInvalidCanonicalRelation.get(childNodeId)) continue;
          canonicalRelationForObject.set(childNodeId, {
            method: "default",
            relationId: relation.id,
          });
        }
      }
    }

    console.log("Identifying canonical relations for all objects via BFS from the global root...");
    const canonicalRelationsFromBFS = getShortestsPaths(GLOBAL_ROOT_ID, data);
    for (const [nodeId, relationId] of canonicalRelationsFromBFS.entries()) {
      if (objectsWithInvalidCanonicalRelation.get(nodeId)) {
        canonicalRelationForObject.set(nodeId, {
          method: "bfs-from-global-root",
          relationId,
        });
      }
    }

    console.log("Identifying better canonical paths for objects disconnected from global root");
    for (const [nodeId, invalidCanonicalRelation] of objectsWithInvalidCanonicalRelation) {
      // Must have an invalid canonical relation, and we haven't found a new one yet
      if (!invalidCanonicalRelation) continue;
      if (canonicalRelationForObject.has(nodeId)) continue;
      // Must be a root node
      const node = data.nodesById.get(nodeId);
      if (!node) continue;
      const nodesRelations = data.relationsByObjectId.get(nodeId) || [];
      if (nodesRelations.length === 0 || nodesRelations.some((r) => r.toId === nodeId)) continue;
      // Consider this a root
      canonicalRelationForObject.set(nodeId, {
        method: "disconnected-root",
        relationId: null,
      });
      // Walk the node's descendants, setting canonical relations as we go
      const canonicalRelationsFromNode = getShortestsPaths(nodeId, data);
      for (const [nodeId, relationId] of canonicalRelationsFromNode.entries()) {
        if (objectsWithInvalidCanonicalRelation.get(nodeId)) {
          canonicalRelationForObject.set(nodeId, {
            method: "bfs-from-disconnected-root",
            relationId,
          });
        }
      }
    }

    const results: {
      type: CanonicalRelationMethod | "not-found-is-hanging" | "not-found-is-not-hanging";
      objectId: string | undefined;
      canonicalRelationId?: string | null;
      object: Object | undefined;
    }[] = Array.from(objectsWithInvalidCanonicalRelation.entries())
      .filter(([_, invalidCanonicalRelation]) => invalidCanonicalRelation)
      .map(([objectId, _]) => {
        const canonicalRelation = canonicalRelationForObject.get(objectId);
        const object = data.getObjectById(objectId);
        if (!canonicalRelation) {
          const isHanging = (data.relationsByObjectId.get(objectId) ?? []).length === 0;
          return {
            type: isHanging ? "not-found-is-hanging" : "not-found-is-not-hanging",
            objectId: object?.id,
            object,
          };
        }
        return {
          type: canonicalRelation.method,
          objectId: object?.id,
          canonicalRelationId: canonicalRelation.relationId,
          object,
        };
      });

    console.log("Results:", {
      default: results.filter((r) => r.type === "default").length,
      "bfs-from-global-root": results.filter((r) => r.type === "bfs-from-global-root").length,
      "bfs-from-disconnected-root": results.filter((r) => r.type === "bfs-from-disconnected-root").length,
      "disconnected-root": results.filter((r) => r.type === "disconnected-root").length,
      "not-found-is-hanging": results.filter((r) => r.type === "not-found-is-hanging").length,
      "not-found-is-not-hanging": results.filter((r) => r.type === "not-found-is-not-hanging").length,
    });

    const outputPath = "./data/results.json";
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log("Results saved to", outputPath);

    console.log("Updating canonical relations...");
    await db.transaction(async (tx) => {
      // Update nodes in batches
      const canonicalRelationsForNodes = new Map<string, string | null>();
      const canonicalRelationsForRelations = new Map<string, string | null>();
      for (const [nodeId, selection] of canonicalRelationForObject.entries()) {
        if (data.nodesById.get(nodeId)) {
          canonicalRelationsForNodes.set(nodeId, selection.relationId);
        } else if (data.relationsById.get(nodeId)) {
          canonicalRelationsForRelations.set(nodeId, selection.relationId);
        } else {
          console.error(`Unknown object type for ${nodeId}`);
        }
      }

      console.log(`Updating ${canonicalRelationsForNodes.size} nodes`);
      for (let i = 0; i < canonicalRelationsForNodes.size; i += BATCH_SIZE) {
        const nodeUpdates = Array.from(canonicalRelationsForNodes.entries()).slice(i, i + BATCH_SIZE);
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

        console.log(`  batch ${i / BATCH_SIZE + 1}`);
        await tx.update(graphNodeTable).set({ canonicalRelationId: finalSql }).where(inArray(graphNodeTable.id, ids));
      }

      console.log(`Updating ${canonicalRelationsForRelations.size} relations`);
      for (let i = 0; i < canonicalRelationsForRelations.size; i += BATCH_SIZE) {
        const relationUpdates = Array.from(canonicalRelationsForRelations.entries()).slice(i, i + BATCH_SIZE);
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

        console.log(`  batch ${i / BATCH_SIZE + 1}`);
        await tx
          .update(graphRelationTable)
          .set({ canonicalRelationId: finalSql })
          .where(inArray(graphRelationTable.id, ids));
      }
    });

    console.log("Done");
  } catch (error) {
    console.error(error);
  } finally {
    await end();
  }
}

main();
