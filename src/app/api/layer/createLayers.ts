import { and, desc, eq, inArray, like, or } from "drizzle-orm";

import { UNLOGGED_USER } from "@/app/auth/MewUser";
import {
  MewUserPublic,
  SerializedGraphStore,
  SerializedNode,
  SerializedRelation,
} from "@/app/persistence/SerializedData";
import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable, relationListsTable, relationTypeTable, userTable } from "@/db/schema";

export const createLayerWithCanonical = async (userId: string, objectIds: string[]): Promise<SerializedGraphStore> => {
  //Note: Skipping loading the positions/labels in this block since we just
  //need relations and nodes for the path. It shouldn't break anything
  //but if it does, revert this.
  const db = getDb();
  const seenIds = new Map<string, boolean>();
  let iterations = 20; //just a fail-safe so we don't get stuck in infinite loop
  let nextNodeIds = new Set<string>(objectIds);

  const snapshot: SerializedGraphStore = {
    usersById: {},
    nodesById: {},
    relationTypesById: {},
    relationsById: {},
    relationsByNodeId: {},
    pinnedRelationsByNodeId: {},
    noteContentRelationsByNodeId: {},
  };

  while (nextNodeIds.size > 0 && iterations--) {
    const result = await db
      .select()
      .from(graphRelationTable)
      .innerJoin(
        graphNodeTable,
        and(
          or(eq(graphNodeTable.id, graphRelationTable.toId), eq(graphNodeTable.id, graphRelationTable.fromId)),
          eq(graphRelationTable.id, graphNodeTable.canonicalRelationId),
        ),
      )
      .where(inArray(graphNodeTable.id, Array.from(nextNodeIds)));

    nextNodeIds.forEach((nodeId) => seenIds.set(nodeId, true));
    nextNodeIds.clear();

    result.forEach((row) => {
      const relation = row.graph_relation;
      const node = row.graph_node;
      if (!relation.fromId || relation.fromId === "global-root-id" || seenIds.has(relation.fromId)) return;
      snapshot.relationsById[relation.id] = getSerializedRelationFromDbRow(relation);
      snapshot.nodesById[node.id] = getSerializedNodeFromDbRow(node);
      nextNodeIds.add(relation.fromId);
    });
  }

  return snapshot;
};

const getSerializedNodeFromDbRow = (row: typeof graphNodeTable.$inferSelect): SerializedNode => {
  return {
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
    accessMode: row.accessMode,
    attributes: row.attributes as SerializedNode["attributes"],
    relationCount: row.relationCount,
  };
};

const getSerializedRelationFromDbRow = (row: typeof graphRelationTable.$inferSelect): SerializedRelation => {
  return {
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
    relationCount: row.relationCount,
  };
};

async function fetchRelationListsInBatches(
  db: any,
  userId: string,
  authorIds: Set<string>,
  relationIds: Set<string>,
  batchSize = 250,
): Promise<any[]> {
  const allRelationListRows = [];
  const relationIdsArray = Array.from(relationIds);

  // Process relations in batches to avoid potential database limitations
  for (let i = 0; i < relationIdsArray.length; i += batchSize) {
    const relationIdsBatch = relationIdsArray.slice(i, i + batchSize);
    const rows = await db
      .select()
      .from(relationListsTable)
      .where(
        and(
          inArray(relationListsTable.relationId, relationIdsBatch),
          or(
            eq(relationListsTable.authorId, userId),
            and(inArray(relationListsTable.authorId, Array.from(authorIds)), eq(relationListsTable.isPublic, true)),
          ),
        ),
      );
    allRelationListRows.push(...rows);
  }

  return allRelationListRows;
}

export const createLayers = async (
  userId: string,
  objectIds: string[],
  layersToLoad = 1,
  loadConnectedLayers = true,
  loadUserRelations = false,
): Promise<SerializedGraphStore> => {
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

  const nodeIds = new Set<string>();
  const authorIds = new Set<string>();
  const relationIds = new Set<string>();
  const relationTypeIds = new Set<string>();

  let objectsLoadedInPrevLayer = new Set<string>();
  const objectsToLoadInNextLayer = new Set<string>(objectIds);

  // First, identify if any of our initial objectIds are relations
  const initialRelationRows = await db
    .select()
    .from(graphRelationTable)
    .where(
      and(
        inArray(graphRelationTable.id, objectIds),
        or(eq(graphRelationTable.authorId, userId), eq(graphRelationTable.isPublic, true)),
      ),
    );

  for (const row of initialRelationRows) {
    relationIds.add(row.id);
    snapshot.relationsById[row.id] = getSerializedRelationFromDbRow(row);
  }

  // Any initial objectIds that aren't relations must be nodes. We handle these separately.
  const initialNodeIds = objectIds.filter((id) => !relationIds.has(id));
  initialNodeIds.forEach((id) => nodeIds.add(id));

  // If loadConnectedLayers is false, skip the layer loading loop
  const layersToLoadActual = loadConnectedLayers ? layersToLoad : 0;

  for (let currentLayer = 0; currentLayer < layersToLoadActual; currentLayer++) {
    // First, get all nodes in the next layer and their relation counts
    const nodeInfoRows = await db
      .select({
        id: graphNodeTable.id,
        relationCount: graphNodeTable.relationCount,
      })
      .from(graphNodeTable)
      .where(
        and(
          inArray(graphNodeTable.id, Array.from(objectsToLoadInNextLayer)),
          or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPublic, true)),
        ),
      );

    const threshold = 200;

    // Split nodes into two groups based on relation count
    const regularNodes = nodeInfoRows
      .filter((row) => !row.relationCount || row.relationCount <= threshold)
      .map((row) => row.id);
    const highRelationNodes = nodeInfoRows
      .filter((row) => row.relationCount && row.relationCount > threshold)
      .map((row) => row.id);

    // Load relations for regular nodes (all relations)
    const regularRelationRows =
      regularNodes.length > 0
        ? await db
            .select()
            .from(graphRelationTable)
            .where(
              and(
                or(inArray(graphRelationTable.fromId, regularNodes), inArray(graphRelationTable.toId, regularNodes)),
                or(eq(graphRelationTable.authorId, userId), eq(graphRelationTable.isPublic, true)),
              ),
            )
        : [];

    // Load limited relations for high-relation nodes
    const highRelationRows =
      highRelationNodes.length > 0
        ? await db
            .select()
            .from(graphRelationTable)
            .where(
              and(
                or(
                  inArray(graphRelationTable.fromId, highRelationNodes),
                  inArray(graphRelationTable.toId, highRelationNodes),
                ),
                or(eq(graphRelationTable.authorId, userId), eq(graphRelationTable.isPublic, true)),
              ),
            )
            .orderBy(desc(graphRelationTable.updatedAt))
            .limit(threshold)
        : [];

    const relationRows = [...regularRelationRows, ...highRelationRows];

    objectsLoadedInPrevLayer = objectsToLoadInNextLayer;
    objectsToLoadInNextLayer.clear();

    for (const row of relationRows) {
      row.authorId && authorIds.add(row.authorId);
      row.id && relationIds.add(row.id);

      // Add the relation to our snapshot
      snapshot.relationsById[row.id] = getSerializedRelationFromDbRow(row);

      // Queue fromId and toId for next layer if we haven't seen them
      if (row.fromId && !objectsLoadedInPrevLayer.has(row.fromId)) {
        objectsToLoadInNextLayer.add(row.fromId);
      }
      if (row.toId && !objectsLoadedInPrevLayer.has(row.toId)) {
        objectsToLoadInNextLayer.add(row.toId);
      }

      row.relationTypeId && relationTypeIds.add(row.relationTypeId);
    }

    if (currentLayer === 0) {
      const rtRelationIds = new Array<string>();

      // We have to check for __type__ relations attached to any of our existing relations.
      // If there is a __type__ relation attached to it, we must load the relation type node.
      // That is, we load the relation type node, the __type__ relation, and if it exists,
      // the relation attached to the __type__ relation node with id __reverse__.

      const typeRelationRows = await db
        .select()
        .from(graphRelationTable)
        .where(
          and(
            inArray(graphRelationTable.fromId, Array.from(relationIds)),
            eq(graphRelationTable.relationTypeId, "__type__"),
          ),
        );

      const customTypeNodeIds = new Set<string>(typeRelationRows.filter((row) => row.fromId).map((row) => row.toId!));
      customTypeNodeIds.forEach((id) => nodeIds.add(id));
      rtRelationIds.push(...typeRelationRows.map((row) => row.id!));

      const reverseRelationRows = await db
        .select()
        .from(graphRelationTable)
        .where(
          and(
            inArray(graphRelationTable.fromId, Array.from(customTypeNodeIds)),
            eq(graphRelationTable.relationTypeId, "__reverse__"),
          ),
        );

      reverseRelationRows.forEach((row) => {
        rtRelationIds.push(row.id);
        row.toId && nodeIds.add(row.toId);
      });

      const rtRelationRows = await db
        .select()
        .from(graphRelationTable)
        .where(inArray(graphRelationTable.id, rtRelationIds));

      rtRelationRows.forEach((row) => {
        row.authorId && authorIds.add(row.authorId);
        row.id && relationIds.add(row.id);

        // Add the relation to our snapshot
        snapshot.relationsById[row.id] = getSerializedRelationFromDbRow(row);
      });
    }

    // For all new objects we're going to load in the next layer,
    // check which ones are relations vs nodes
    if (objectsToLoadInNextLayer.size > 0) {
      const newRelationRows = await db
        .select()
        .from(graphRelationTable)
        .where(
          and(
            inArray(graphRelationTable.id, Array.from(objectsToLoadInNextLayer)),
            or(eq(graphRelationTable.authorId, userId), eq(graphRelationTable.isPublic, true)),
          ),
        );

      // Add these relations to our tracking
      for (const row of newRelationRows) {
        relationIds.add(row.id);
        snapshot.relationsById[row.id] = getSerializedRelationFromDbRow(row);
      }

      // Any IDs that weren't found as relations must be nodes
      const foundRelationIds = new Set(newRelationRows.map((row) => row.id));
      for (const id of objectsToLoadInNextLayer) {
        if (!foundRelationIds.has(id)) {
          nodeIds.add(id);
        }
      }
    }
  }

  // Load nodes
  const nodeRows = await db
    .select()
    .from(graphNodeTable)
    .where(
      and(
        inArray(graphNodeTable.id, Array.from(nodeIds)),
        or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPublic, true)),
      ),
    );

  for (const row of nodeRows) {
    const node: SerializedNode = getSerializedNodeFromDbRow(row);
    snapshot.nodesById[node.id] = node;
  }

  // Only load relations of relations if we're loading connected layers
  if (loadConnectedLayers) {
    // Load relations of relations
    const relationChildrenRows = await db
      .select()
      .from(graphRelationTable)
      .where(inArray(graphRelationTable.fromId, Array.from(relationIds)));

    for (const row of relationChildrenRows) {
      relationIds.add(row.id);
      snapshot.relationsById[row.id] = getSerializedRelationFromDbRow(row);
    }
  }

  // Todo: Maybe we can do a inner join with nodes?
  // Does it make sense to do another DB call separately.
  const userRows = await db
    .select()
    .from(userTable)
    .where(inArray(userTable.id, Array.from(authorIds)));
  for (const row of userRows) {
    const user: MewUserPublic = {
      id: row.id,
      username: row.username || row.email!,
      email: row.email!,
    };
    snapshot.usersById[user.id] = user;
  }

  const relationListRows = await fetchRelationListsInBatches(db, userId, authorIds, relationIds);

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

  const relationTypePublicRows = await db
    .select()
    .from(relationTypeTable)
    .where(
      and(
        inArray(relationTypeTable.id, Array.from(relationTypeIds)),
        or(eq(relationTypeTable.isPublic, true), eq(relationTypeTable.authorId, userId)),
      ),
    )
    .orderBy(desc(relationTypeTable.isPublic));

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

  // Load user relations if requested
  if (loadUserRelations) {
    const userRelationTypeNodes = await db
      .select({
        id: graphNodeTable.id,
        authorId: graphNodeTable.authorId,
      })
      .from(graphNodeTable)
      .where(like(graphNodeTable.id, "user-relation-types-node-id-%"));

    const sublistNodes = await db
      .select({
        relationId: graphRelationTable.id,
        id: graphNodeTable.id,
      })
      .from(graphNodeTable)
      .innerJoin(graphRelationTable, eq(graphRelationTable.fromId, graphNodeTable.id))
      .where(
        and(
          inArray(
            graphRelationTable.fromId,
            userRelationTypeNodes.map((n) => n.id),
          ),
          eq(graphRelationTable.relationTypeId, "sublist"),
        ),
      );

    const reverseNodes = await db
      .select({
        relationId: graphRelationTable.id,
        id: graphNodeTable.id,
      })
      .from(graphNodeTable)
      .innerJoin(graphRelationTable, eq(graphRelationTable.fromId, graphNodeTable.id))
      .where(
        and(
          inArray(
            graphRelationTable.fromId,
            sublistNodes.map((n) => n.id),
          ),
          eq(graphRelationTable.relationTypeId, "__reverse__"),
        ),
      );

    const additionalNodeIds = [
      ...userRelationTypeNodes.map((n) => n.id),
      ...sublistNodes.map((n) => n.id),
      ...reverseNodes.map((n) => n.id),
    ];

    const additionalRelationIds = [...sublistNodes.map((n) => n.relationId), ...reverseNodes.map((n) => n.relationId)];

    // Load additional nodes
    const additionalNodeRows = await db
      .select()
      .from(graphNodeTable)
      .where(
        and(
          inArray(graphNodeTable.id, additionalNodeIds),
          or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPublic, true)),
        ),
      );

    for (const row of additionalNodeRows) {
      snapshot.nodesById[row.id] = getSerializedNodeFromDbRow(row);
    }

    // Load additional relations
    const additionalRelationRows = await db
      .select()
      .from(graphRelationTable)
      .where(
        and(
          inArray(graphRelationTable.id, additionalRelationIds),
          or(eq(graphRelationTable.authorId, userId), eq(graphRelationTable.isPublic, true)),
        ),
      );

    for (const row of additionalRelationRows) {
      snapshot.relationsById[row.id] = getSerializedRelationFromDbRow(row);
      row.relationTypeId && relationTypeIds.add(row.relationTypeId);
    }

    // Load additional relation lists
    const additionalRelationListRows = await fetchRelationListsInBatches(
      db,
      userId,
      new Set([...authorIds, ...userRelationTypeNodes.map((n) => n.authorId)].filter(Boolean)),
      new Set(additionalRelationIds),
    );

    for (const row of additionalRelationListRows) {
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
  }

  return snapshot;
};

/**
 * Create initial layers for essential user objects with their first levels.
 * This ensures all necessary default objects are loaded along with their immediate children.
 */
export const createInitialLayers = async (userId: string): Promise<SerializedGraphStore> => {
  const userRootId = `user-root-id-${userId}`;
  const myHashtagsId = `user-my-hashtags-node-id-${userId}`;
  const myTemplatesId = `user-template-id-${userId}`;
  const myFavoritesId = `user-my-favorites-node-id-${userId}`;
  const myStreamId = `user-my-stream-node-id-${userId}`;
  const relationTypesId = `user-relation-types-node-id-${userId}`;
  const cardStatusesId = `user-card-statuses-node-id-${userId}`;

  // Essential objects that need their first level loaded
  const essentialObjectIds = [userRootId, myHashtagsId, myTemplatesId, myFavoritesId, relationTypesId, cardStatusesId];

  // Load the essential objects with their connected layers
  const essentialData = await createLayers(userId, essentialObjectIds, 1, true);
  const firstLayerTemplates = await createLayers(userId, [myTemplatesId], 2, true);
  Object.assign(essentialData.nodesById, firstLayerTemplates.nodesById);
  Object.assign(essentialData.relationsById, firstLayerTemplates.relationsById);
  Object.assign(essentialData.relationsByNodeId, firstLayerTemplates.relationsByNodeId);
  Object.assign(essentialData.pinnedRelationsByNodeId, firstLayerTemplates.pinnedRelationsByNodeId);
  Object.assign(essentialData.noteContentRelationsByNodeId, firstLayerTemplates.noteContentRelationsByNodeId);

  // Load the first 100 nodes of "my stream" separately to avoid loading too much
  const db = getDb();
  const myStreamChildRelations = await db
    .select({ toId: graphRelationTable.toId })
    .from(graphRelationTable)
    .where(
      and(
        eq(graphRelationTable.fromId, myStreamId),
        eq(graphRelationTable.relationTypeId, "child"),
        or(eq(graphRelationTable.authorId, userId), eq(graphRelationTable.isPublic, true)),
      ),
    )
    .limit(100);

  const streamNodeIds = myStreamChildRelations.map((row) => row.toId).filter((id): id is string => id !== null);

  if (streamNodeIds.length > 0) {
    // Load stream nodes without their connected layers to avoid exponential expansion
    const streamData = await createLayers(userId, streamNodeIds, 1, false);

    // Merge the stream data into essential data
    Object.assign(essentialData.nodesById, streamData.nodesById);
    Object.assign(essentialData.relationsById, streamData.relationsById);
    Object.assign(essentialData.relationsByNodeId, streamData.relationsByNodeId);
    Object.assign(essentialData.pinnedRelationsByNodeId, streamData.pinnedRelationsByNodeId);
    Object.assign(essentialData.noteContentRelationsByNodeId, streamData.noteContentRelationsByNodeId);
  }

  return essentialData;
};
