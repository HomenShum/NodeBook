import { useCallback } from "react";

import { useAuth } from "@/app/auth/useAuth";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { ExtractEntitiesRequest } from "@/app/llm/ExtractEntitiesRequest";
import { transformExtractResponse } from "@/app/llm/transformExtractResponse";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";

export const useParseWithAi = () => {
  const auth = useAuth();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();

  return useCallback(
    async (node: GraphNode) => {
      const textToParse = node.text;

      if (!textToParse) {
        return;
      }

      // Show loading spinner next to node controls
      viewStore.setNodeIsProcessing(node.id);

      const requestBody: ExtractEntitiesRequest = {
        nodeText: textToParse,
      };

      const authToken = await auth?.getAccessTokenSilently();
      const response = await fetch("/api/extract-entities", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        viewStore.clearNodeIsProcessing(node.id);
        logger.error("Failed to parse with AI", response);
        return;
      }

      const { extractedEntities } = await response.json();
      await transformExtractResponse(graphStore, node, extractedEntities);

      viewStore.clearNodeIsProcessing(node.id);
    },
    [auth, graphStore, viewStore],
  );
};
