//@ts-nocheck

import fs from "fs";

import { inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { getDb } from "@/db";
import { graphNodeTable, graphRelationTable } from "@/db/schema";
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
const defaultRelationTypeKeys = new Set(Object.keys(defaultRelationTypes));

function createNodeId() {
  // Modify as needed; you might want to do nanoid(), a UUID library, etc.
  return uuidv4().slice(0, 16);
}

async function updateRelationTypes() {
  const db = getDb(env.POSTGRES_CONNECTION_STRING);
  const oldData = JSON.parse(fs.readFileSync("mew-big-relations-and-types.json", "utf8"));
  console.log(oldData.relations.find((r) => r.id === "ent-rel-13488"));
  console.log(oldData.allRelationTypes.filter((r) => r.id === "ent-rt-90"));
  const { relations: oldRelations, allRelationTypes: allOldRelationTypes } = oldData;
  console.log("Relations:", oldRelations.length, "RelationTypes:", allOldRelationTypes.length);
  const oldRelationIds = new Set<string>(oldRelations.map((r) => r.id));

  const allOldRelationTypesById = new Map<string, Object>(allOldRelationTypes.map((rt) => [rt.id, rt]));
  const allOldRelationsById = new Map<string, Object>(oldRelations.map((r) => [r.id, r]));

  const authorId = "auth0|678758b367e8bff682448d2b";
  const parentRelationTypesNodeId = "user-relation-types-node-id-auth0|678758b367e8bff682448d2b";

  try {
    await db.transaction(async (tx) => {
      async function createRelationTypeNode(id, label, reverseLabel) {
        // (A) Insert the label node
        const labelNodeId = id;
        await tx.insert(graphNodeTable).values({
          id: labelNodeId,
          authorId,
          content: JSON.stringify([{ type: "text", value: label ?? "is" }]),
          isPublic: true,
        });
        // (B) Connect label node to the user’s "Relation Types" node
        await tx.insert(graphRelationTable).values({
          id: createNodeId(),
          authorId,
          fromId: parentRelationTypesNodeId,
          toId: labelNodeId,
          relationTypeId: defaultRelationTypes.sublist.id,
          isPublic: true,
        });

        // (C) If there's a reverseLabel, create that node as child of labelNode (with relationType="__reverse__")
        const reverseLabelNodeId = createNodeId();
        await tx.insert(graphNodeTable).values({
          id: reverseLabelNodeId,
          authorId,
          content: JSON.stringify([{ type: "text", value: reverseLabel ?? "is of" }]),
          isPublic: true,
        });

        await tx.insert(graphRelationTable).values({
          id: createNodeId(),
          authorId,
          fromId: labelNodeId,
          toId: reverseLabelNodeId,
          relationTypeId: defaultRelationTypes.__reverse__.id,
          isPublic: true,
        });
      }
      // get all relations
      const relations = await tx.select().from(graphRelationTable);
      const relationIds = new Set<string>(relations.map((r) => r.id));
      const relationsById = new Map<string, Object>(relations.map((r) => [r.id, r]));
      const nodes = await tx.select().from(graphNodeTable);
      const nodesById = new Map<string, Object>(nodes.map((n) => [n.id, n]));
      const allNodeIdsSet = new Set<string>(nodes.map((n) => n.id));
      console.log(`Found ${relations.length} relations in database`);

      // get all relations that overlap with old relations

      const filteredRelations = relations.filter((r) => oldRelationIds.has(r.id));

      console.log(`Found ${filteredRelations.length} relations that overlap with old relations`);

      // For each relation, check if the relation type label is the same as the old relation type label

      const allRelationIdsSet = new Set<string>(relations.map((r) => r.id));
      function is__type__Relation(relation: (typeof relations)[number]) {
        return relation.relationTypeId === "__type__" && relation.fromId && allRelationIdsSet.has(relation.fromId);
      }
      const __type__Relations = relations.filter(is__type__Relation);

      console.log(__type__Relations.length, " __type__ relations");

      const oldCustomRelations = oldRelations.filter(
        (r) => !Object.keys(defaultRelationTypes).includes(r.relationTypeId),
      );

      // Get all new relation type nodes

      function is__rev__Relation(relation: (typeof relations)[number]) {
        return relation.relationTypeId === "__reverse__" && relation.fromId && allNodeIdsSet.has(relation.fromId);
      }

      const __rev__Relations = relations.filter(is__rev__Relation);

      console.log(__rev__Relations.length, " __rev__ relations");

      const relationTypeNodeIds = new Set<string>(__rev__Relations.map((r) => r.fromId));
      const relationTypeNodes = nodes.filter((n) => relationTypeNodeIds.has(n.id));

      //**** */
      const relationTypeNodesByLabel = new Map<string, Object>(
        relationTypeNodes.map((n) => [JSON.parse(n.content)[0].value, n]),
      );
      const relationTypeNodesById = new Map<string, Object>(relationTypeNodes.map((n) => [n.id, n]));

      const relationTypeNodeByRelId = new Map<string, Object>(
        __type__Relations.map((r) => [r.fromId, relationTypeNodesById.get(r.toId)]),
      );

      // Let's see how many of the old relation types have a corresponding label
      const oldRelationTypesWithCorrespondingLabel = allOldRelationTypes.filter((rt) =>
        relationTypeNodesByLabel.get(rt.label),
      );

      console.log(oldRelationTypesWithCorrespondingLabel.length, " old relation types with corresponding label");

      let incorrectLabel = 0;
      let correctLabel = 0;
      let noRelTypeNode = 0;
      let labelExistsInTypeNodes = 0;
      let labelDNEInTypeNodes = 0;
      const incorrButLabelExists = new Set<string>();
      const incorrectLabelIds = new Set<string>();
      const correctLabelIds = new Set<string>();
      const labelDNEIds = new Set<string>();
      let nonEntRels = 0;
      const relationsIdsToDelete = new Array<string>();
      const relationsToCreate = new Array<{
        id: string;
        fromId: string;
        toId: string;
        relationTypeId: string;
        isPublic: boolean;
        authorId: string;
      }>();
      const typeNodesToCreateByFwLabel = new Map<
        string,
        {
          id: string;
          label: string;
          reverseLabel: string;
        }
      >();
      let c = 0;
      for (const oldRel of oldRelations) {
        c++;

        if (!defaultRelationTypeKeys.has(oldRel.relationTypeId) && relationIds.has(oldRel.id)) {
          const oldRelationTypeRow = allOldRelationTypesById.get(oldRel.relationTypeId);
          if (oldRelationTypeRow) {
            const oldLabel = oldRelationTypeRow.label;
            const newRelTypeNode = relationTypeNodeByRelId.get(oldRel.id);

            if (!newRelTypeNode) {
              noRelTypeNode++; // create type node w/ reverse label and connect it to the relation
              // check if the label exists in the type nodes
              if (relationTypeNodesByLabel.get(oldLabel)) {
                // look for an exsting type node with the right label
                // create the type relation connecting the relation to the type node
                const typeNodeId = relationTypeNodesByLabel.get(oldLabel).id;
                relationsToCreate.push({
                  id: createNodeId(),
                  fromId: oldRel.id,
                  toId: typeNodeId,
                  relationTypeId: defaultRelationTypes.__type__.id,
                  isPublic: true,
                  authorId,
                });
              } else {
                // We have to create a new type node
                const oldLabel = oldRelationTypeRow.label;
                const oldReverseLabel = oldRelationTypeRow.reverseLabel;
                let newTypeNodeId = createNodeId();
                if (!typeNodesToCreateByFwLabel.has(oldLabel)) {
                  typeNodesToCreateByFwLabel.set(oldLabel, {
                    id: newTypeNodeId,
                    label: oldLabel,
                    reverseLabel: oldReverseLabel,
                  });
                } else {
                  newTypeNodeId = typeNodesToCreateByFwLabel.get(oldLabel).id;
                }
                relationsToCreate.push({
                  id: createNodeId(),
                  fromId: oldRel.id,
                  toId: newTypeNodeId,
                  relationTypeId: defaultRelationTypes.__type__.id,
                  isPublic: true,
                  authorId,
                });
              }
              continue;
            }
            const newLabel = JSON.parse(newRelTypeNode.content)[0].value;
            if (oldLabel === newLabel) {
              correctLabelIds.add(oldRel.id);

              correctLabel++; // Do nothing
            } else {
              incorrectLabel++;
              incorrectLabelIds.add(oldRel.id);

              if (relationTypeNodesByLabel.get(oldLabel)) {
                if (oldRel.id === "ent-rel-13488") {
                  console.log("oldRel", oldRel);
                  console.log("newRelTypeNode", newRelTypeNode);
                }
                const correctRelTypeNode = relationTypeNodesByLabel.get(oldLabel);
                labelExistsInTypeNodes++;
                incorrButLabelExists.add(oldRel.id);
                // Delete the old __type__ relation,
                // Connect existing relation type node to this relation
                const typeRelation = __type__Relations.find((r) => r.fromId === oldRel.id);
                if (typeRelation) {
                  relationsIdsToDelete.push(typeRelation.id);
                }
                relationsToCreate.push({
                  id: createNodeId(),
                  fromId: oldRel.id,
                  toId: correctRelTypeNode.id,
                  relationTypeId: defaultRelationTypes.__type__.id,
                  isPublic: true,
                  authorId,
                });
              } else {
                labelDNEInTypeNodes++;
                labelDNEIds.add(oldRel.id);

                const typeRelation = __type__Relations.find((r) => r.fromId === oldRel.id);
                if (typeRelation) {
                  relationsIdsToDelete.push(typeRelation.id);
                }
                // create type node w/ reverse label and connect it to the relation
                const oldLabel = oldRelationTypeRow.label;
                const oldReverseLabel = oldRelationTypeRow.reverseLabel;
                let newTypeNodeId = createNodeId();
                if (!typeNodesToCreateByFwLabel.has(oldLabel)) {
                  typeNodesToCreateByFwLabel.set(oldLabel, {
                    id: newTypeNodeId,
                    label: oldLabel,
                    reverseLabel: oldReverseLabel,
                  });
                } else {
                  newTypeNodeId = typeNodesToCreateByFwLabel.get(oldLabel).id;
                }
                relationsToCreate.push({
                  id: createNodeId(),
                  fromId: oldRel.id,
                  toId: newTypeNodeId,
                  relationTypeId: defaultRelationTypes.__type__.id,
                  isPublic: true,
                  authorId,
                });
              }
            }
          }
        }
      }
      // First, create the type nodes
      let t = 0;

      const firstPassNodesToCreate = new Array();
      const firstPassRelationsToCreate = new Array();
      for (const typeNode of typeNodesToCreateByFwLabel.values()) {
        const { id, label, reverseLabel } = typeNode;
        // (A) Insert the label node
        const labelNodeId = id;

        firstPassNodesToCreate.push({
          id: labelNodeId,
          authorId,
          content: JSON.stringify([{ type: "text", value: label ?? "is" }]),
          isPublic: true,
          slug: null,
        });
        // (B) Connect label node to the user’s "Relation Types" node

        firstPassRelationsToCreate.push({
          id: createNodeId(),
          authorId,
          fromId: parentRelationTypesNodeId,
          toId: labelNodeId,
          relationTypeId: defaultRelationTypes.sublist.id,
          isPublic: true,
        });

        // (C) If there's a reverseLabel, create that node as child of labelNode (with relationType="__reverse__")
        const reverseLabelNodeId = createNodeId();

        firstPassNodesToCreate.push({
          id: reverseLabelNodeId,
          authorId,
          content: JSON.stringify([{ type: "text", value: reverseLabel ?? "is of" }]),
          isPublic: true,
          slug: null,
        });

        firstPassRelationsToCreate.push({
          id: createNodeId(),
          authorId,
          fromId: labelNodeId,
          toId: reverseLabelNodeId,
          relationTypeId: defaultRelationTypes.__reverse__.id,
          isPublic: true,
        });
      }
      console.log(`Creating ${firstPassNodesToCreate.length} nodes and ${firstPassRelationsToCreate.length} relations`);
      if (firstPassNodesToCreate.length > 0) {
        await tx.insert(graphNodeTable).values(firstPassNodesToCreate);
      }
      if (firstPassRelationsToCreate.length > 0) {
        await tx.insert(graphRelationTable).values(firstPassRelationsToCreate);
      }
      console.log("Done with first pass");
      // Delete the old __type__ relations
      console.log(`Deleting ${relationsIdsToDelete.length} relations`);
      await tx.delete(graphRelationTable).where(inArray(graphRelationTable.id, relationsIdsToDelete));
      // Create the new relations
      console.log(`Creating ${relationsToCreate.length} relations`);
      await tx.insert(graphRelationTable).values(relationsToCreate);
      console.log(relationsToCreate.find((r) => r.fromId === "ent-rel-13488"));

      console.log("Done with second pass");
    });
  } catch (error) {
    console.error("Error updating relation types:", error);
  }
}
updateRelationTypes();
