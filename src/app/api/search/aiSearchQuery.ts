import { createEntities, perplexitySearch } from "@/app/api/search/helpers";
import { AiSearchQueryResponse } from "@/app/api/search/types";

export const aiSearchQuery = async (
  userId: string,
  query: string,
  rootNodeId: string,
  createQueryNode: boolean,
  addNodesInQueryTermToGraph: boolean = false,
): Promise<AiSearchQueryResponse> => {
  const { nodes, edges, aiResponse } = await perplexitySearch(query, addNodesInQueryTermToGraph);

  const stats = await createEntities(nodes, edges, userId, rootNodeId, query, createQueryNode);

  return {
    aiGraph: {
      nodes: nodes,
      edges: edges,
      aiResponse: aiResponse,
    },
    stats,
  };
};
