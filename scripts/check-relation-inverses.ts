import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { relationTypeTable } from "@/db/schema";
import { env } from "@/envBackend";
import { getInverseRelation } from "@/lib/relation-inverter";

async function checkRelationInverses(dryRun = true) {
  try {
    console.log(`Running in ${dryRun ? "dry run" : "update"} mode`);
    const db = getDb(env.POSTGRES_CONNECTION_STRING);

    const relationTypes = await db.select().from(relationTypeTable);
    console.log(`Found ${relationTypes.length} relation types`);

    let changesCount = 0;
    for (const relationType of relationTypes) {
      const currentReverseLabel = relationType.reverseLabel;
      const computedReverseLabel = relationType.label ? getInverseRelation(relationType.label) : "";

      if (currentReverseLabel !== computedReverseLabel) {
        changesCount++;
        console.log(`\nRelation Type: ${relationType.label}`);
        console.log(`Current reverse label: ${currentReverseLabel}`);
        console.log(`Computed reverse label: ${computedReverseLabel}`);

        if (!dryRun) {
          await db
            .update(relationTypeTable)
            .set({ reverseLabel: computedReverseLabel })
            .where(eq(relationTypeTable.id, relationType.id));
          console.log("Updated reverse label");
        }
      }
    }

    console.log(`\nFound ${changesCount} relation types that would be changed`);
    console.log("Done checking relation inverses");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the script with command line argument --update to perform actual updates
if (require.main === module) {
  const dryRun = !process.argv.includes("--update");
  checkRelationInverses(dryRun).then(() => process.exit(0));
}
