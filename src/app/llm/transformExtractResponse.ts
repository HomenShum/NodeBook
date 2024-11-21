import { GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { uuid } from "@/app/util";
import logger from "@/lib/logger";

export const transformExtractResponse = async (
  graphStore: GraphStore,
  sourceNode: GraphNode,
  extractResponse: string,
) => {
  // Extract entities response is a string with the following format:
  //
  // Entity Name
  // - relation: Other Entity
  // - different relation: Another Entity
  //
  // Some Different Entity
  // - relation: Other Entity

  if (!extractResponse) {
    return;
  }

  const lines = extractResponse.split("\n");

  // We make all nodes and relations in a single transaction so that "undo" will remove all of them
  const txs: TxCombined = [];

  const entitiesRootId = uuid();
  txs.push({
    type: "addNode",
    transaction: {
      nodeProps: { id: entitiesRootId, content: `Extracted entities` },
    },
  });

  let curEntityNodeId: string | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      curEntityNodeId = null;
      continue;
    }

    if (curEntityNodeId === null && trimmedLine.startsWith("-")) {
      logger.warn("[Parse with AI] Found relation line without entity", trimmedLine);
      continue;
    }

    if (curEntityNodeId === null) {
      curEntityNodeId = uuid();
      txs.push({
        type: "addChildNode",
        transaction: {
          parentId: entitiesRootId,
          nodeProps: { id: curEntityNodeId, content: trimmedLine },
        },
      });
      continue;
    }

    const relationLineRegex = /^- (.+?): (.+)$/;
    const relationLineMatch = trimmedLine.match(relationLineRegex);
    if (!relationLineMatch) {
      logger.warn("[Parse with AI] Found invalid relation line", trimmedLine);
      continue;
    }
    const [relationText, otherEntityText] = relationLineMatch.slice(1);
    const relationId = uuid();
    txs.push(
      {
        type: "addChildNode",
        transaction: {
          parentId: curEntityNodeId,
          nodeProps: { content: otherEntityText },
          relationProps: { id: relationId },
        },
      },
      {
        type: "updateRelation",
        transaction: {
          relationId: relationId,
          relationProps: { relationTypeLabel: relationText },
        },
      },
    );
  }

  txs.push({
    type: "addRelation",
    transaction: { fromId: sourceNode.id, toId: entitiesRootId },
  });

  await graphStore.applyCombinedTransaction(txs);
};
