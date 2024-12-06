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

  if (nodeLinkingSetting === "LinkNodesInGraph") {
    // If user setting is to link nodes in the graph, we check if there's any existing node with the same content
    for (const entity of extractedEntities) {
      const searchResults = graphStore.search({ text: entity.name, filters: { types: ["node"] } });
      for (const result of searchResults.nodes) {
        if (result.node.content.map((c) => c.value).join("") !== entity.name) {
          continue;
        }
        const otherNodeId = result.node.id;
        entityNodeIdsByEntityName[entity.name] = otherNodeId;
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

  for (const entity of extractedEntities) {
    if (entityNodeIdsByEntityName[entity.name]) {
      // If we've already linked this entity to an existing node, skip adding it as a new node
      continue;
    }
    entityNodeIdsByEntityName[entity.name] = uuid();
    txs.push({
      type: "addChildNode",
      transaction: {
        parentId: entitiesRootId,
        nodeProps: { id: entityNodeIdsByEntityName[entity.name], content: entity.name },
      },
    });
  }

  for (const entity of extractedEntities) {
    const entityNodeId = entityNodeIdsByEntityName[entity.name];
    for (const rel of entity.relations) {
      for (const otherEntity of rel.otherEntities) {
        if (nodeLinkingSetting !== "None" && entityNodeIdsByEntityName[otherEntity]) {
          // If the other entity is one of the top-level entities extracted in this parse, just add a relation
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

  txs.push({
    type: "addRelation",
    transaction: { fromId: sourceNode.id, toId: entitiesRootId },
  });

  graphStore.applyCombinedTransaction(txs);
};
