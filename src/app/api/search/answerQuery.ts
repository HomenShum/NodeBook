import { and, eq, or, sql } from "drizzle-orm";

import { createLayers } from "@/app/api/layer/createLayers";
import { SerializedGraphStore } from "@/app/persistence/SerializedData";
import { getDb } from "@/db";
import { graphNodeTable } from "@/db/schema";

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
  db.execute(sql`SELECT set_limit(0.9);`);
  const query_words: string[] = query.split(" ").map((word) => word.toLowerCase());
  let nodeRows: { id: string }[] = [];
  if (query_words.length === 1) {
    const query_str = `%${query_words[0]}%`;
    // nodeRows = await db
    //   .select({ id: graphNodeTable.id })
    //   .from(graphNodeTable)
    //   .where(
    //     and(
    //       sql`content_text like '%${query_str}%'`,
    //       or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPublic, true)),
    //     ),
    //   )
    //   .limit(50);
    const result = await db.execute(
      sql`SELECT id FROM graph_node WHERE content_text ILIKE ${query_str} AND (author_id = ${userId} OR is_public = true) LIMIT 50`,
    );
    nodeRows = result.rows.map((row) => ({ id: row.id as string }));
  } else {
    nodeRows = await db
      .select({ id: graphNodeTable.id })
      .from(graphNodeTable)
      .where(
        and(sql`${query} <% content_text`, or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPublic, true))),
      )
      .limit(50);
  }

  return createLayers(
    userId,
    nodeRows.map((row) => row.id),
  );
};
