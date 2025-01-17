/**
 * This script was created for a one-off operation to copy data from
 * one of Jacob's accounts to another. I'm leaving it here in case
 * we need to do something similar again.
 *
 * See https://linear.app/ideaflow/issue/ENT-4609/copy-jacobs-mew-data-to-a-password-protected-account
 */
import readline from "readline";

import { Command } from "commander";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { end, getDb } from "@/db";
import { graphNodeTable, graphRelationTable, relationListsTable, relationTypeTable } from "@/db/schema";
import { MewDatabase } from "@/db/types";
import { env } from "@/envBackend";
import {
  GLOBAL_ADMIN_USER_ID,
  USER_MY_HASHTAGS_NODE_ID_PREFIX,
  USER_ROOT_ID_PREFIX,
  USERS_TO_USER_RELATION_ID_PREFIX,
} from "@/lib/constants";

export const defaultRelationTypes = {
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

export type Chip =
  | {
      type: "text" | "mention" | "linebreak";
      value: string;
    }
  | {
      type: "link";
      value: string;
      url: string;
    };

export const uuid = () => uuidv4().slice(0, 8);

const BATCH_SIZE = 500;

async function copyUserData(db: MewDatabase, originalAuthorId: string, newAuthorId: string) {
  // Create a transaction for atomic operation
  return await db.transaction(async (tx) => {
    // Fetch all data for the original author
    const nodes = await tx.select().from(graphNodeTable).where(eq(graphNodeTable.authorId, originalAuthorId));
    const relations = await tx
      .select()
      .from(graphRelationTable)
      .where(eq(graphRelationTable.authorId, originalAuthorId));
    const relationLists = await tx
      .select()
      .from(relationListsTable)
      .where(eq(relationListsTable.authorId, originalAuthorId));

    // Generate new ids for the original author's nodes
    const nodeIdMap = new Map<string, string>();
    nodes.forEach((node) => {
      if (node.id.startsWith(USER_ROOT_ID_PREFIX)) {
        nodeIdMap.set(node.id, USER_ROOT_ID_PREFIX + newAuthorId);
      } else if (node.id.startsWith(USER_MY_HASHTAGS_NODE_ID_PREFIX)) {
        nodeIdMap.set(node.id, USER_MY_HASHTAGS_NODE_ID_PREFIX + newAuthorId);
      } else {
        nodeIdMap.set(node.id, uuid());
      }
    });

    // Generate new ids for the original author's relations
    const relationIdMap = new Map<string, string>();
    relations.forEach((relation) => {
      if (relation.id.startsWith(USERS_TO_USER_RELATION_ID_PREFIX)) {
        relationIdMap.set(relation.id, USERS_TO_USER_RELATION_ID_PREFIX + newAuthorId);
      } else {
        relationIdMap.set(relation.id, uuid());
      }
    });

    console.log("Copying", {
      nodes: nodes.length,
      relations: relations.length,
      relationLists: relationLists.length,
    });

    // Insert nodes with new IDs
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE);
      await tx
        .insert(graphNodeTable)
        .values(
          batch.map((node) => {
            const mappedId = nodeIdMap.get(node.id);
            if (!mappedId) {
              throw new Error(`No mapped id for node ${node.id}`);
            }
            const content = JSON.parse(node.content || "[]") as Chip[];
            // If the node references a node we created a copy of, then
            // replace the id with the id of the new author's copied node.
            const newContent = content.map((chip) => {
              if (chip.type === "mention") {
                return {
                  ...chip,
                  value: nodeIdMap.get(chip.value) || chip.value,
                };
              }
              return chip;
            });
            return {
              ...node,
              pk: undefined,
              content: JSON.stringify(newContent),
              id: mappedId,
              authorId: newAuthorId,
            };
          }),
        )
        // For some nodes, the id we generated will conflict with an existing one
        // e.g. default nodes like My Hashtags node. In this case, we want to keep
        // the existing one, so skip the conflict.
        .onConflictDoNothing();
    }

    // Insert relations with new ids and updated references
    const newRelations: any[] = [];
    for (const relation of relations) {
      // Ignore the original author's relation to their own My Hashtags node.
      // The new author already has that relation to their own by default.
      if (relation.toId && relation.toId.startsWith(USER_MY_HASHTAGS_NODE_ID_PREFIX)) {
        continue;
      }
      if (relation.fromId === null || relation.toId === null || relation.relationTypeId === null) {
        console.error("Null relation fields", relation);
        continue;
      }
      const mappedId = relationIdMap.get(relation.id);
      if (!mappedId) {
        console.error("No mapped id for relation", relation);
        continue;
      }
      // If the relation references a node or relation that doesn't exist in the new author's graph,
      // we assume it's a global object and keep the original id. We include logs so we can check
      // if this is the case.
      let mappedFromId = nodeIdMap.get(relation.fromId) || relationIdMap.get(relation.fromId);
      let mappedToId = nodeIdMap.get(relation.toId) || relationIdMap.get(relation.toId);
      let missingIds: { fromId?: string; toId?: string } = {};
      if (!mappedFromId) {
        mappedFromId = relation.fromId;
        missingIds.fromId = relation.fromId;
      }
      if (!mappedToId) {
        mappedToId = relation.toId;
        missingIds.toId = relation.toId;
      }
      if (Object.keys(missingIds).length > 0) {
        console.log("Missing ids for relation", relation.id, missingIds);
      }

      newRelations.push({
        ...relation,
        pk: undefined,
        id: mappedId,
        authorId: newAuthorId,
        fromId: mappedFromId,
        toId: mappedToId,
        relationTypeId: relation.relationTypeId,
      });
    }
    for (let i = 0; i < newRelations.length; i += BATCH_SIZE) {
      console.log(`Inserting ${i} to ${i + BATCH_SIZE} of ${newRelations.length} relations`);
      await tx
        .insert(graphRelationTable)
        .values(newRelations.slice(i, i + BATCH_SIZE))
        .onConflictDoNothing();
    }

    // Insert relation lists with updated references
    const newRelationLists = relationLists
      .map((list) => {
        if (list.nodeId === null || list.relationId === null) {
          console.error("Null node or relation id for relation list", list);
          return null;
        }
        let mappedNodeId = nodeIdMap.get(list.nodeId);
        let mappedRelationId = relationIdMap.get(list.relationId);
        const missingIds: { nodeId?: string; relationId?: string } = {};
        if (!mappedNodeId) {
          mappedNodeId = list.nodeId;
          missingIds.nodeId = list.nodeId;
        }
        if (!mappedRelationId) {
          mappedRelationId = list.relationId;
          missingIds.relationId = list.relationId;
        }
        if (Object.keys(missingIds).length > 0) {
          console.log("Missing ids for relation list", list.id, missingIds);
        }
        return {
          ...list,
          id: undefined,
          authorId: newAuthorId,
          nodeId: mappedNodeId,
          relationId: mappedRelationId,
        };
      })
      .filter((list) => list !== null);
    for (let i = 0; i < newRelationLists.length; i += BATCH_SIZE) {
      console.log(`Inserting ${i} to ${i + BATCH_SIZE} of ${newRelationLists.length} relation lists`);
      const batch = newRelationLists.slice(i, i + BATCH_SIZE);
      await tx.insert(relationListsTable).values(batch).onConflictDoNothing();
    }
  });
}

async function deleteUserData(db: MewDatabase, authorId: string) {
  console.log("Deleting data for", authorId);
  await db.transaction(async (tx) => {
    let res: any[] = [];
    const today = new Date().toISOString().split("T")[0];

    res = await tx.delete(graphNodeTable).where(eq(graphNodeTable.authorId, authorId)).returning();
    console.log(`Deleted ${res.length} graph nodes`);

    res = await tx.delete(graphRelationTable).where(eq(graphRelationTable.authorId, authorId)).returning();
    console.log(`Deleted ${res.length} graph relations`);

    res = await tx.delete(relationTypeTable).where(eq(relationTypeTable.authorId, authorId)).returning();
    console.log(`Deleted ${res.length} relation types`);

    res = await tx.delete(relationListsTable).where(eq(relationListsTable.authorId, authorId)).returning();
    console.log(`Deleted ${res.length} relation lists`);
  });
}

async function main() {
  const program = new Command();

  program.name("user-data-manager").description("CLI to manage user data");

  program
    .command("copy")
    .description("Copy data from one user to another")
    .argument("<sourceUserId>", "Source user ID")
    .argument("<targetUserId>", "Target user ID")
    .action(async (sourceUserId, targetUserId) => {
      const connectionString = env.POSTGRES_CONNECTION_STRING;
      const dbName = new URL(connectionString).pathname.slice(1);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const proceed = await new Promise<boolean>((resolve) => {
        rl.question(
          "\n" +
            [
              `WARNING: This will create a copy of ${sourceUserId}'s data and associated it with ${targetUserId}`,
              `DATABASE: ${dbName}`,
              "Are you sure you want to proceed? (y/N) ",
            ].join("\n\n"),
          (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === "y");
          },
        );
      });

      if (!proceed) {
        console.log("Operation cancelled");
        process.exit(0);
      }

      const db = getDb(connectionString);
      await copyUserData(db, sourceUserId, targetUserId);
      await end();
    });

  program
    .command("delete")
    .description("Delete user data")
    .argument("<userId>", "User ID to delete")
    .action(async (userId) => {
      const connectionString = env.POSTGRES_CONNECTION_STRING;
      const db = getDb(connectionString);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const proceed = await new Promise<boolean>((resolve) => {
        rl.question("Are you sure you want to proceed? (y/N) ", (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === "y");
        });
      });

      if (!proceed) {
        console.log("Operation cancelled");
        process.exit(0);
      }

      console.log(`Deleting data for ${userId}`);
      await deleteUserData(db, userId);
      await end();
    });

  await program.parseAsync();
}

if (require.main === module) {
  main();
}
