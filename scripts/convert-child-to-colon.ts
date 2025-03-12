import { and, eq, like, not, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { graphRelationTable } from "@/db/schema";
import { env } from "@/envBackend";

async function convertEntChildRelations() {
  const db = getDb(env.POSTGRES_CONNECTION_STRING);

  try {
    await db.transaction(async (tx) => {
      console.log("Starting conversion of ent- child relations to empty type...");

      // Find and update relations:
      // - id starts with 'ent-'
      // - relationTypeId is 'child'
      // - No __type__ relation points from it
      const result = await tx
        .update(graphRelationTable)
        .set({ relationTypeId: "empty" })
        .where(
          and(
            like(graphRelationTable.id, "ent-%"),
            eq(graphRelationTable.relationTypeId, "child"),
            not(
              sql`exists (
                select 1 from ${graphRelationTable} type_rel
                where type_rel.from_id = ${graphRelationTable.id}
                and type_rel.relation_type_id = '__type__'
              )`,
            ),
          ),
        )
        .returning({ id: graphRelationTable.id });

      // const inverseResult = await tx
      //   .select()
      //   .from(graphRelationTable)
      //   .where(
      //     and(
      //       like(graphRelationTable.id, "ent-%"),
      //       eq(graphRelationTable.relationTypeId, "child"),
      //       sql`exists (
      //         select 1 from ${graphRelationTable} type_rel
      //         where type_rel.from_id = ${graphRelationTable.id}
      //         and type_rel.relation_type_id = '__type__'
      //       )`,
      //     ),
      //   );
      //

      console.log(`Converted ${result.length} relations from child to empty type`);
      console.log("Conversion completed successfully");
    });
  } catch (error) {
    console.error("Error during conversion:", error);
    throw error;
  }
}

// Run the conversion
convertEntChildRelations()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
