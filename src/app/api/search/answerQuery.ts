import { and, desc, eq, or, sql } from "drizzle-orm";

import { createLayers } from "@/app/api/layer/createLayers";
import { SerializedGraphStore } from "@/app/persistence/SerializedData";
import { getDb } from "@/db";
import { graphNodeTable } from "@/db/schema";
import { env } from "@/envBackend";

export const answerQuery = async (
  userId: string,
  query: string,
  sessionId = "unknown",
  short_text = false,
): Promise<SerializedGraphStore> => {
  console.timeLog(sessionId, "[debug] Inside answerQuery, before getDb()");
  const db = getDb();
  console.timeLog(sessionId, "[debug] Inside answerQuery, after getDb()");
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
  db.execute(sql`SELECT set_limit(0.95);`);
  console.timeLog(sessionId, "[debug] Inside answerQuery, after SELECT set_limit(0.95)");
  let nodeRows: { id: string }[] = [];

  // Select top 100 ordered by trie match score
  // Replace all contiguous spaces with %
  let query_str = query.replace(/\s+/g, "%");

  if (query_str[0] !== "%") {
    query_str = "%" + query_str;
  }
  if (query_str[query_str.length - 1] !== "%") {
    query_str = query_str + "%";
  }

  console.timeLog(sessionId, "[debug] Inside answerQuery, after if/else of length<16");
  // If the query is less than 16 characters, don't use the word similarity function
  if (query_str.length < 16) {
    nodeRows = await db
      .select({ id: graphNodeTable.id })
      .from(graphNodeTable)
      .where(
        and(
          sql`content_text ILIKE ${query_str}`,
          or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPublic, true)),
          ...(short_text ? [sql`${graphNodeTable.contentTextLength} < 400`] : []),
        ),
      )
      .limit(100);
    console.timeLog(sessionId, "[debug] Inside answerQuery, inside IF query len<16 after fetching node rows");
  } else {
    nodeRows = await db
      .select({ id: graphNodeTable.id })
      .from(graphNodeTable)
      .where(
        and(
          sql`content_text ILIKE ${query_str}`,
          or(eq(graphNodeTable.authorId, userId), eq(graphNodeTable.isPublic, true)),
          ...(short_text ? [sql`${graphNodeTable.contentTextLength} < 400`] : []),
        ),
      )
      .orderBy(desc(sql`strict_word_similarity(${query}, content_text)`))
      .limit(100);
    console.timeLog(sessionId, "[debug] Inside answerQuery, inside ELSE query len>= after fetching node rows");
  }

  console.timeLog(sessionId, "[debug] Inside answerQuery, after selecting nodeRows (global)");

  // Only load the specific search result nodes without their connected layers
  // This dramatically improves performance by avoiding exponential data expansion
  console.timeLog(sessionId, `[debug] Inside answerQuery, before createLayers`);
  const layers = createLayers(
    userId,
    nodeRows.map((row) => row.id),
    1, // layersToLoad (unused when loadConnectedLayers = false)
    false, // loadConnectedLayers = false for search results
  );
  console.timeLog(sessionId, `[debug] Inside answerQuery, after createLayers`);
  console.timeEnd(sessionId);
  return layers;
};
