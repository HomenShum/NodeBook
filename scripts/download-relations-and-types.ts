import fs from "fs";
import { env } from "process";

import { notInArray } from "drizzle-orm";

import { getDb } from "@/db";
import { graphRelationTable, relationTypeTable } from "@/db/schema";
import { GLOBAL_ADMIN_USER_ID } from "@/lib/constants";

const defaultRelationTypes = {
  child: {
    version: 1,
    id: "child",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "child",
    reverseLabel: "parent",
    isPublic: false,
  },
  relatedTo: {
    version: 1,
    id: "relatedTo",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "relates to",
    reverseLabel: "relates to",
    isPublic: false,
  },
  author: {
    version: 1,
    id: "author",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "author",
    reverseLabel: "authored",
    isPublic: false,
  },
  sublist: {
    version: 1,
    id: "sublist",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "sublist",
    reverseLabel: "sublist of",
    isPublic: false,
  },
  __type__: {
    version: 1,
    id: "__type__",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "__type__",
    reverseLabel: "__type_of__",
    isPublic: false,
  },
  __reverse__: {
    version: 1,
    id: "__reverse__",
    authorId: GLOBAL_ADMIN_USER_ID,
    label: "__reverse__",
    reverseLabel: "__forward__",
    isPublic: false,
  },
  empty: { version: 1, id: "empty", authorId: GLOBAL_ADMIN_USER_ID, label: "", reverseLabel: "", isPublic: false },
};

async function updateRelationTypes() {
  const db = getDb(env.POSTGRES_CONNECTION_STRING);
  try {
    await db.transaction(async (tx) => {
      // get all relations with relation type id not in defaultRelationTypes
      const relations = await tx
        .select()
        .from(graphRelationTable)
        .where(notInArray(graphRelationTable.relationTypeId, Object.keys(defaultRelationTypes)));

      console.log(`Found ${relations.length} relations with relation type id not in defaultRelationTypes`);

      // Grab all of these relation types from the table

      const allRelationTypeIds = new Set<string>(relations.map((r) => r.relationTypeId).filter((id) => id !== null));

      console.log(`Found ${allRelationTypeIds.size} unique relation types in the database`);

      const allRelationTypes = await tx.select().from(relationTypeTable);
      // .where(inArray(relationTypeTable.id, Array.from(allRelationTypeIds)));

      // Save the relation types and relations to a file.

      fs.writeFileSync("mew-big-relations-and-types.json", JSON.stringify({ relations, allRelationTypes }));
    });
  } catch (error) {
    console.error("Error updating relation types:", error);
  }
}
updateRelationTypes();
