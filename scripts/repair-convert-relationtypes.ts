/**
 * migrationRelationTypes.ts
 *
 * Script to migrate custom relation types into a node-based model.
 *
 * Steps (in high-level pseudocode form):
 *
 * 1. For each user, ensure there's a "Relation Types" node connected to the user root.
 * 2. For each non-default relation type in `relation_type`:
 *    - Create a new node under the user’s "Relation Types" node with content = `label`.
 *    - Create a child node of that new node with relation type = "__reverse__" and content = `reverseLabel`.
 *    - Remove the relation_type row.
 * 3. For each relation in `graph_relation` referencing a non-default relation type:
 *    - Set `relationTypeId` to "child".
 *    - Create a new `graph_relation` of type "__type__" from that relation’s `id` to the newly created "relation type" node.
 */

import { v4 as uuidv4 } from "uuid";

import { getDb } from "@/db";
import { graphRelationTable, userTable } from "@/db/schema";
import { env } from "@/envBackend";
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

/**
 * Helper: produce a new node ID (or you can do something else for unique IDs).
 * Drizzle won't generate them automatically for your custom `id` fields,
 * so you might do: "authorId-uuid()" or something similar.
 */
function createNodeId() {
  // Modify as needed; you might want to do nanoid(), a UUID library, etc.
  return uuidv4().slice(0, 16);
}

/**
 * The main migration function.
 */
async function migrateRelationTypes() {
  const db = getDb(env.POSTGRES_CONNECTION_STRING);
  try {
    await db.transaction(async (tx) => {
      console.log("Starting relation types migration...");

      // 1) Fetch all users, relation types, and relations:
      const users = await tx.select().from(userTable); // PersistedUser[]

      // For each user, ensure user-root node and "Relation Types" node exist (or create them).
      for (const user of users) {
        const userId = user.id;

        // A) Find/create the user root node.
        //    (Adjust this logic if your user’s root node is stored differently.)
        let userRootNode = await tx.query.graphNodeTable.findFirst({
          where: (fields, { eq }) => eq(fields.id, `user-root-id-${userId}`),
        });
        if (!userRootNode) {
          console.log("Couldn't find user root node for ${user.id}");
          continue;
        }

        // B) Find/create the user’s "Relation Types" node
        //    Suppose we store it as userId + "::relation-types"
        const desiredRelationTypesNodeId = `user-relation-types-node-id-${userId}`;

        let relationToUserRelationTypes = await tx.query.graphRelationTable.findFirst({
          where: (fields, { eq }) => eq(fields.toId, desiredRelationTypesNodeId),
        });
        if (!relationToUserRelationTypes) {
          // Also create a relation from the user root -> relation types node
          //  of type "child" (if that is your default for subnodes).
          await tx.insert(graphRelationTable).values({
            id: createNodeId(),
            authorId: userId,
            fromId: userRootNode.id,
            toId: desiredRelationTypesNodeId,
            relationTypeId: "child",
            isPublic: true,
          });
          console.log(`Created "__user_relation_types__" relation for user ${userId}`);
        } else {
        }
      }

      console.log("Relation types migration complete!");
    });
  } catch (err) {
    // Handle any errors and perform any logging
    console.error("Transaction failed and rolled back: ", err);
  }
}

// Invoke directly if this file is being run as a script
if (require.main === module) {
  migrateRelationTypes().then(() => {
    console.log("Done.");
  });
}
