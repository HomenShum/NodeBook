import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { userTable } from "@/db/schema";
import { env } from "@/envBackend";

const connectionString = env.POSTGRES_CONNECTION_STRING;

async function main() {
  const db = getDb(connectionString);

  // Get all users
  const users = await db
    .select({
      id: userTable.id,
    })
    .from(userTable);

  console.log(`Found ${users.length} users to process`);

  // Start a transaction for all the queries
  await db.transaction(async (tx) => {
    for (const user of users) {
      const userId = user.id;

      // Extract the unique identifier part after the provider prefix
      const userIdParts = userId.split("|");
      if (userIdParts.length !== 2) {
        console.log(`Skipping user ${userId} - invalid format`);
        continue;
      }

      const userRootId = `user-root-id-${userId}`;
      const userStreamId = `user-stream-id-${userId}`;

      // First check for conflicts - entries that already exist with userStreamId
      const conflictCheck = await tx.execute(sql`
        select rl1.relation_id 
        from relation_lists rl1
        where rl1.node_id = ${userStreamId}
        and exists (
          select 1 from relation_lists rl2
          where rl2.node_id = ${userRootId}
          and rl2.relation_id = rl1.relation_id
          and rl2.relation_id in (
            select id from graph_relation 
            where from_id = ${userStreamId}
          )
          and rl2.relation_id not in (
            select id from graph_relation 
            where to_id = ${userStreamId} 
            and from_id = ${userRootId}
          )
        )
      `);

      const conflictingIds = conflictCheck.rows.map((row: Record<string, unknown>) => sql.raw(String(row.relation_id)));

      if (conflictingIds.length > 0) {
        console.log(`Found ${conflictingIds.length} conflicts for user ${userId}`);
      }

      const result = await tx.execute(sql`
        update relation_lists
        set node_id = ${userStreamId}
        where node_id=${userRootId}
        and relation_id in (
          select id from graph_relation
          where from_id = ${userStreamId}
        )
        and relation_id not in (
          select id from graph_relation
          where to_id = ${userStreamId}
          and from_id = ${userRootId}
        )
        and relation_id not in ( select rl1.relation_id 
        from relation_lists rl1
        where rl1.node_id = ${userStreamId}
        )
      `);

      console.log(`Updated ${result.rowCount} relations for user ${userId}`);

      // Delete the leftover entries in the relation lists.

      // // Delete relation lists where node_id is the user root ID
      // const deleteResult = await tx.execute(sql`
      //   delete from relation_lists
      //   where node_id = ${userRootId}
      //   and relation_id in (
      //     select id from graph_relation
      //     where from_id = ${userStreamId}
      //   )
      //   and relation_id not in (
      //     select id from graph_relation
      //     where to_id = ${userStreamId}
      //     and from_id = ${userRootId}
      //   );
      // `);

      // console.log(`Deleted ${deleteResult.rowCount} leftover relation lists for user ${userId}`);
    }
  });

  console.log("Finished processing all users");
}

main().catch(console.error);
