import { ExtractedEntity } from "@/app/api/extract-entities/ExtractEntitiesOpenAiResponse";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { uuid } from "@/app/util";

export const processExtractResponse = async (
  graphStore: GraphStore,
  sourceNode: GraphNode,
  extractedEntities: ExtractedEntity[],
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
  for (const entity of extractedEntities) {
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
        if (entityNodeIdsByEntityName[otherEntity]) {
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
        } else {
          // If the other entity is not one of the top-level entities, make it a simple child node of the entity
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
  }

  txs.push({
    type: "addRelation",
    transaction: { fromId: sourceNode.id, toId: entitiesRootId },
  });

  await graphStore.applyCombinedTransaction(txs);
};
