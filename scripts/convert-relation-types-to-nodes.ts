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

import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { end, getDb } from "@/db";
import { graphNodeTable, graphRelationTable, relationTypeTable, userTable } from "@/db/schema";
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
  return uuidv4().slice(0, 8);
}

/**
 * The main migration function.
 */
async function migrateRelationTypes() {
  const db = getDb(env.POSTGRES_CONNECTION_STRING);

  try {
    console.log("Starting relation types migration...");

    // 1) Fetch all users, relation types, and relations:
    const users = await db.select().from(userTable); // PersistedUser[]
    const allRelationTypes = await db.select().from(relationTypeTable); // PersistedRelationType[]
    const allRelations = await db.select().from(graphRelationTable); // PersistedGraphRelation[]

    // 2) For convenience, store all non-default relation types keyed by their ID:
    const nonDefaultRelationTypes = allRelationTypes.filter((rt) => !Object.keys(defaultRelationTypes).includes(rt.id));

    // 3) Build a map of each user’s "Relation Types Node" (we’ll create them if missing)
    //    Also build a map of user root node if you store it under the same ID as user.id,
    //    or fetch from your existing logic.
    const userRootNodeIds = new Map<string, string>();
    const userRelationTypesNodeIds = new Map<string, string>();

    // For each user, ensure user-root node and "Relation Types" node exist (or create them).
    for (const user of users) {
      const userId = user.id;
      if (userId === "global-admin-user-id") {
        continue;
      }

      // A) Find/create the user root node.
      //    (Adjust this logic if your user’s root node is stored differently.)
      let userRootNode = await db.query.graphNodeTable.findFirst({
        where: (fields, { eq }) => eq(fields.id, `user-root-id-${userId}`),
      });
      if (!userRootNode) {
        // Create a user root node:
        const rootId = userId; // or something else
        const [insertedRoot] = await db
          .insert(graphNodeTable)
          .values({
            id: rootId,
            authorId: userId,
            content: JSON.stringify([{ type: "text", value: `${user.username}'s Root` }]),
          })
          .returning();
        userRootNode = insertedRoot;
        console.log(`Created root node for user ${userId}`);
      }
      userRootNodeIds.set(userId, userRootNode.id);

      // B) Find/create the user’s "Relation Types" node
      //    Suppose we store it as userId + "::relation-types"
      const desiredRelationTypesNodeId = `user-relation-types-node-id-${userId}`;

      let userRelationTypesNode = await db.query.graphNodeTable.findFirst({
        where: (fields, { eq }) => eq(fields.id, desiredRelationTypesNodeId),
      });
      if (!userRelationTypesNode) {
        const [insertedRelationTypes] = await db
          .insert(graphNodeTable)
          .values({
            id: desiredRelationTypesNodeId,
            authorId: userId,
            content: JSON.stringify([{ type: "text", value: "__user_relation_types__" }]),
            isPublic: true,
          })
          .returning();
        userRelationTypesNode = insertedRelationTypes;

        // Also create a relation from the user root -> relation types node
        //  of type "child" (if that is your default for subnodes).
        await db.insert(graphRelationTable).values({
          id: createNodeId(),
          authorId: userId,
          fromId: userRootNode.id,
          toId: userRelationTypesNode.id,
          relationTypeId: "child",
          isPublic: true,
        });
        console.log(`Created "__user_relation_types__" node for user ${userId}`);
      }
      userRelationTypesNodeIds.set(userId, userRelationTypesNode.id);
    }

    // 4) For each non-default relation type, create a node (the "label" node),
    //    then create its child node for the `reverseLabel`.
    //    We’ll track the newly created node’s ID for referencing from relations.
    const newRelationTypeNodeByOldTypeId = new Map<string, string>();

    for (const rt of nonDefaultRelationTypes) {
      const { authorId, id: relationTypeId, label, reverseLabel } = rt;

      // Create the main node for this relation type’s label:
      const parentRelationTypesNodeId = userRelationTypesNodeIds.get(authorId);
      if (!parentRelationTypesNodeId) {
        console.warn(
          `Could not find "Relation Types" node for user ${authorId}. Skipping relation_type ${relationTypeId}`,
        );
        continue;
      }

      // (A) Insert the label node
      const labelNodeId = createNodeId();
      await db.insert(graphNodeTable).values({
        id: labelNodeId,
        authorId,
        content: JSON.stringify([{ type: "text", value: label ?? "is" }]),
        isPublic: true,
      });
      // (B) Connect label node to the user’s "Relation Types" node
      await db.insert(graphRelationTable).values({
        id: createNodeId(),
        authorId,
        fromId: parentRelationTypesNodeId,
        toId: labelNodeId,
        relationTypeId: defaultRelationTypes.sublist.id,
        isPublic: true,
      });

      // (C) If there's a reverseLabel, create that node as child of labelNode (with relationType="__reverse__")
      const reverseLabelNodeId = createNodeId();
      await db.insert(graphNodeTable).values({
        id: reverseLabelNodeId,
        authorId,
        content: JSON.stringify([{ type: "text", value: reverseLabel ?? "is of" }]),
        isPublic: true,
      });

      await db.insert(graphRelationTable).values({
        id: createNodeId(),
        authorId,
        fromId: labelNodeId,
        toId: reverseLabelNodeId,
        relationTypeId: defaultRelationTypes.__reverse__.id,
        isPublic: true,
      });

      // Bookkeeping: store the newly created label node for referencing in step #5
      newRelationTypeNodeByOldTypeId.set(relationTypeId, labelNodeId);

      // (D) Remove the row from the relationTypeTable
      //     (But first confirm you no longer need it for referencing. If you do, skip this until after step #5.)
      await db.delete(relationTypeTable).where(eq(relationTypeTable.id, relationTypeId));
    }

    // 5) For each relation whose relationTypeId is not in defaultRelationTypes,
    //    set relationTypeId to "child", then create a new `graph_relation` of type "__type__"
    //    from that relation (by its .id) to the newly created "relation-type label" node.
    //
    //    The reason we can do "fromId = relation.id" is because your BFS logic suggests
    //    relations are also "objects" in the graph. If that’s not the case for your system,
    //    you may need a different approach.
    const updateCandidates = allRelations.filter(
      (rel) => rel.relationTypeId && !Object.keys(defaultRelationTypes).includes(rel.relationTypeId),
    );
    for (const rel of updateCandidates) {
      const oldTypeId = rel.relationTypeId!;
      const newTypeNodeId = newRelationTypeNodeByOldTypeId.get(oldTypeId);
      if (!newTypeNodeId) {
        console.warn(`No mapped node for old relationTypeId = ${oldTypeId}`);
        continue;
      }

      // A) Update the existing relation to "child"
      await db.update(graphRelationTable).set({ relationTypeId: "child" }).where(eq(graphRelationTable.pk, rel.pk));

      // B) Create a new link of type "__type__" from this relation (treated as an object) to the new node
      await db.insert(graphRelationTable).values({
        id: createNodeId(),
        authorId: rel.authorId,
        fromId: rel.id, // the relation’s own ID
        toId: newTypeNodeId, // the newly created label node
        relationTypeId: defaultRelationTypes.__type__.id,
        isPublic: true,
      });
    }

    console.log("Relation types migration complete!");
  } catch (err) {
    console.error("Error in relation types migration:", err);
  } finally {
    await end();
  }
}

// Invoke directly if this file is being run as a script
if (require.main === module) {
  migrateRelationTypes().then(() => {
    console.log("Done.");
  });
}
