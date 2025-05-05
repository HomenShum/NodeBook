import axios from "axios";

import { AiSearchQueryResponse } from "@/app/api/search/types";

//Mutation of attributes handled by GraphStore.
const AiSearchQueryResource = {
  search: async ({
    query,
    rootNodeId,
    createQueryNode,
  }: {
    query: string;
    rootNodeId: string;
    createQueryNode: boolean;
  }) =>
    axios.post<AiSearchQueryResponse>(`/api/search`, {
      query,
      rootNodeId,
      createQueryNode,
    }),
};

export default AiSearchQueryResource;
