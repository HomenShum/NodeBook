import { eq, or } from "drizzle-orm";

import { UNLOGGED_USER } from "@/app/auth/MewUser";
import { MewUserPublic, SerializedGraphStore, SerializedNode } from "@/app/persistence/SerializedData";
import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable, relationListsTable, relationTypeTable, userTable } from "@/db/schema";

export const createSnapshotFromDb = async (userId: string): Promise<SerializedGraphStore> => {
  const snapshot: SerializedGraphStore = {
    usersById: {},
    nodesById: {},
    relationTypesById: {},
    relationsById: {},
    relationsByNodeId: {},
    pinnedRelationsByNodeId: {},
    noteContentRelationsByNodeId: {},
  };

  const db = getDb();

  // Load users from db
  const userRows = await db.select().from(userTable);
  for (const row of userRows) {
    const user: MewUserPublic = {
      id: row.id,
      username: row.username || row.email!,
      email: row.email!,
    };
    snapshot.usersById[user.id] = user;
  }

  // Load nodes from db
  const nodeRows = await db
    .select()
    .from(graphNodeTable)
    .where(or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPublic, true)));
  for (const row of nodeRows) {
    const node: SerializedNode = {
      version: row.version,
      id: row.id,
      authorId: row.authorId ?? UNLOGGED_USER.id,
      createdAt: row.createdAt!,
      updatedAt: row.updatedAt ?? row.createdAt!,
      content: JSON.parse(row.content ?? ""),
      isPublic: !!row.isPublic,
      isNewRelatedObjectsPublic: !!row.isNewRelatedObjectsPublic,
      canonicalRelationId: row.canonicalRelationId ?? null,
      isChecked: row.isChecked,
    };
    snapshot.nodesById[node.id] = node;
  }

  // Load public rows for relation types first, then authored rows.
  // This way if there's any ID collision, then the authored row will overwrite the public row.
  // TODO: figure out a better way to handle this
  const relationTypePublicRows = await db.select().from(relationTypeTable).where(eq(relationTypeTable.isPublic, true));
  for (const row of relationTypePublicRows) {
    snapshot.relationTypesById[row.id] = {
      id: row.id,
      authorId: row.authorId,
      version: row.version,
      label: row.label ?? "",
      reverseLabel: row.reverseLabel ?? "",
      isPublic: !!row.isPublic,
    };
  }
  const relationTypeAuthoredRows = await db
    .select()
    .from(relationTypeTable)
    .where(eq(relationTypeTable.authorId, userId));
  for (const row of relationTypeAuthoredRows) {
    snapshot.relationTypesById[row.id] = {
      id: row.id,
      authorId: row.authorId,
      version: row.version,
      label: row.label ?? "",
      reverseLabel: row.reverseLabel ?? "",
      isPublic: !!row.isPublic,
    };
  }

  // Load relations from db
  const relationRows = await db
    .select()
    .from(graphRelationTable)
    .where(or(eq(graphRelationTable.authorId, userId), eq(graphRelationTable.isPublic, true)));
  for (const row of relationRows) {
    snapshot.relationsById[row.id] = {
      version: row.version,
      id: row.id,
      authorId: row.authorId ?? UNLOGGED_USER.id,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(row.createdAt?.getTime()!) ?? new Date(),
      fromId: row.fromId ?? "",
      toId: row.toId ?? "",
      relationTypeId: row.relationTypeId ?? "",
      isPublic: !!row.isPublic,
      canonicalRelationId: row.canonicalRelationId ?? null,
    };
  }

  // Load relation lists from db
  const relationListRows = await db
    .select()
    .from(relationListsTable)
    .where(or(eq(relationListsTable.authorId, userId), eq(relationListsTable.isPublic, true)));
  for (const row of relationListRows) {
    const { nodeId, relationId } = row;
    if (!nodeId || !relationId) continue;
    if (!snapshot.relationsById[relationId]) continue;
    if (row.type === "pinned") {
      if (!snapshot.pinnedRelationsByNodeId[nodeId]) {
        snapshot.pinnedRelationsByNodeId[nodeId] = {};
      }
      snapshot.pinnedRelationsByNodeId[nodeId][relationId] = {
        int: row.positionInt ?? 0,
        frac: row.positionFrac ?? "",
      };
    } else if (row.type === "noteContent") {
      if (!snapshot.noteContentRelationsByNodeId[nodeId]) {
        snapshot.noteContentRelationsByNodeId[nodeId] = {};
      }
      snapshot.noteContentRelationsByNodeId[nodeId][relationId] = {
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
