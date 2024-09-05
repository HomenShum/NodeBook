import { eq, or } from "drizzle-orm";

import { UNLOGGED_USER } from "@/app/auth/MewUser";
import { SerializedGraphStore, SerializedNode } from "@/app/persistence/SerializedData";
import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable, relationListsTable, relationTypeTable } from "@/db/schema";

export const createSnapshotFromDb = async (userId: string): Promise<SerializedGraphStore> => {
  const snapshot: SerializedGraphStore = {
    nodesById: {},
    relationTypesById: {},
    relationsById: {},
    relationsByNodeId: {},
    pinnedRelationsByNodeId: {},
  };

  const db = getDb();

  const nodeRows = await db
    .select()
    .from(graphNodeTable)
    .where(or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPrivate, false)));
  for (const row of nodeRows) {
    const node: SerializedNode = {
      version: row.version,
      id: row.id,
      authorId: row.authorId ?? UNLOGGED_USER.id,
      createdAt: row.createdAt!,
      content: JSON.parse(row.content ?? ""),
      isBundle: !!row.isBundle,
      isZone: !!row.isZone,
      isPrivate: !!row.isPrivate,
    };
    snapshot.nodesById[node.id] = node;
  }

  const relationTypeRows = await db.select().from(relationTypeTable).where(eq(relationTypeTable.authorId, userId));
  for (const row of relationTypeRows) {
    snapshot.relationTypesById[row.id] = {
      id: row.id,
      authorId: row.authorId,
      version: row.version,
      label: row.label ?? "",
      reverseLabel: row.reverseLabel ?? "",
    };
  }

  const relationRows = await db
    .select()
    .from(graphRelationTable)
    .where(or(eq(graphRelationTable.authorId, userId), eq(graphRelationTable.isPrivate, false)));
  for (const row of relationRows) {
    snapshot.relationsById[row.id] = {
      version: row.version,
      id: row.id,
      authorId: row.authorId ?? UNLOGGED_USER.id,
      fromId: row.fromId ?? "",
      toId: row.toId ?? "",
      relationTypeId: row.relationTypeId ?? "",
      isPrivate: !!row.isPrivate,
    };
  }

  const relationListRows = await db.select().from(relationListsTable).where(eq(relationListsTable.authorId, userId));
  for (const row of relationListRows) {
    const { nodeId, relationId } = row;
    if (!nodeId || !relationId) continue;
    if (!snapshot.relationsById[relationId]) continue;
    if (row.pinned) {
      if (!snapshot.pinnedRelationsByNodeId[nodeId]) {
        snapshot.pinnedRelationsByNodeId[nodeId] = {};
      }
      snapshot.pinnedRelationsByNodeId[nodeId][relationId] = {
        int: row.positionInt ?? 0,
        frac: row.positionFrac ?? "",
      };
    } else {
      if (!snapshot.relationsByNodeId[nodeId]) {
        snapshot.relationsByNodeId[nodeId] = {};
      }
      snapshot.relationsByNodeId[nodeId][relationId] = {
        int: row.positionInt ?? 0,
        frac: row.positionFrac ?? "",
      };
    }
  }

  return snapshot;
};
