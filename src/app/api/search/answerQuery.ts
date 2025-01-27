import { and, eq, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { graphNodeTable } from "@/db/schema";
import { createLayers } from "@/app/api/layer/createLayers";
import { SerializedGraphStore } from "@/app/persistence/SerializedData";

export const answerQuery = async (userId: string, query: string): Promise<SerializedGraphStore> => {
  const db = getDb();

  if (query.length < 3) {
    return {
      usersById: {},
      nodesById: {},
      relationTypesById: {},
      relationsById: {},
      relationsByNodeId: {},
      pinnedRelationsByNodeId: {},
      noteContentRelationsByNodeId: {},
    };
  }

  // We do not to add another index for `isPublic` and `authorId`. The ps engine would be
  // able to use the GIN index and filter out results after, in some cases a sequential
  // scan would be performed if the engine believes that would be faster.

  const nodeRows = await db
    .select({ id: graphNodeTable.id })
    .from(graphNodeTable)
    .where(
      and(
        sql`content_tsvector @@ plainto_tsquery('english', ${query})`,
        or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPublic, true)),
      ),
    );

  return createLayers(
    userId,
    nodeRows.map((row) => row.id),
  );
};
