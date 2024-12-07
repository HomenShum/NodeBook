import { ExtractedEntity } from "@/app/api/extract-entities/ExtractEntitiesOpenAiResponse";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { uuid } from "@/app/util";
import { ParseWithAiLinkingOption } from "@/db/schema";

export const processExtractResponse = async (
  graphStore: GraphStore,
  sourceNode: GraphNode,
  extractedEntities: ExtractedEntity[],
  nodeLinkingSetting: ParseWithAiLinkingOption,
) => {
  if (!extractedEntities.length) {
    return;
  }

  // We make all nodes and relations in a single transaction so that "undo" will remove all of them
  const txs: TxCombined = [];

  const entitiesRootId = uuid();
  txs.push({
    type: "addNode",
    transaction: {
      nodeProps: { id: entitiesRootId, content: `Extracted entities` },
    },
  });

  const entityNodeIdsByEntityName: { [entityName: string]: string } = {};

  let extractedEntityNames = extractedEntities
    .map((e) => e.name) // All the top level entities
    .concat(extractedEntities.flatMap((e) => e.relations.flatMap((r) => r.otherEntities))); // Everything listed as a target in relations
  extractedEntityNames = [...new Set(extractedEntityNames)]; // Remove duplicates

  if (nodeLinkingSetting === "LinkNodesInGraph") {
    // If user setting is to link nodes in the graph, we check if there's any existing node with the same content
    for (const entity of extractedEntityNames) {
      const searchResults = graphStore.search({ text: entity, filters: { types: ["node"] } });
      for (const result of searchResults.nodes) {
        if (result.node.content.map((c) => c.value).join("") !== entity) {
          continue;
        }
        const otherNodeId = result.node.id;
        entityNodeIdsByEntityName[entity] = otherNodeId;
        txs.push({
          type: "addRelation",
          transaction: {
            fromId: entitiesRootId,
            toId: otherNodeId,
          },
        });
        break;
      }
    }
  }

  for (const entity of extractedEntityNames) {
    if (entityNodeIdsByEntityName[entity]) {
      // If we've already linked this entity to an existing node, skip adding it as a new node
      continue;
    }
    entityNodeIdsByEntityName[entity] = uuid();
    txs.push({
      type: "addChildNode",
      transaction: {
        parentId: entitiesRootId,
        nodeProps: { id: entityNodeIdsByEntityName[entity], content: entity },
      },
    });
  }

  for (const entity of extractedEntities) {
    const entityNodeId = entityNodeIdsByEntityName[entity.name];
    for (const rel of entity.relations) {
      for (const otherEntity of rel.otherEntities) {
        if (nodeLinkingSetting !== "None" && entityNodeIdsByEntityName[otherEntity]) {
          // If the other entity is one of the top-level entities extracted in this parse, we want to add a relation.
          const otherNodeId = entityNodeIdsByEntityName[otherEntity];

          // First, though, we do a check to see if the relation already exists to avoid duplicates.
          const entityNode = graphStore.getNode(entityNodeId);
          const existingRelation = entityNode?.relations.find(
            (r) =>
              (r.to.id === otherNodeId || r.from.id === otherNodeId) &&
              (r.relationType.label === rel.relation || r.relationType.reverseLabel === rel.relation),
          );
          if (existingRelation) {
            continue;
          }

          // If the relation doesn't exist, we add it in two steps: first, add the relation, then make sure the relation type is set properly.
          const relationId = uuid();
          txs.push(
            {
              type: "addRelation",
              transaction: {
                id: relationId,
                fromId: entityNodeId,
                toId: entityNodeIdsByEntityName[otherEntity],
              },
            },
            {
              type: "updateRelation",
              transaction: {
                relationId: relationId,
                relationProps: { relationTypeLabel: rel.relation },
              },
            },
          );
          continue;
        }

        // Default case: target for this line is not a full entity we're linking to, so just add it as a new node
        const relationId = uuid();
        txs.push(
          {
            type: "addChildNode",
            transaction: {
              parentId: entityNodeId,
              nodeProps: { content: otherEntity },
              relationProps: { id: relationId },
            },
          },
          {
            type: "updateRelation",
            transaction: {
              relationId: relationId,
              relationProps: { relationTypeLabel: rel.relation },
            },
          },
        );
      }
    }
  }

  const relToEntitiesRootId = uuid();
  txs.push({
    type: "addRelation",
    transaction: { id: relToEntitiesRootId, fromId: sourceNode.id, toId: entitiesRootId },
  });

  graphStore.applyCombinedTransaction(txs);

  return relToEntitiesRootId;
};
