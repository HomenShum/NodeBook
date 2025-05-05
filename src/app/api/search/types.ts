export type Completion = {
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
};

export type AiNode = {
  label: string;
  whyRelevant: string;
};

export type AiEdge = {
  from: string;
  to: string;
  relationship: string;
};

export type AiGraph = {
  nodes: AiNode[];
  edges: AiEdge[];
  aiResponse: string;
};

export type AiSearchStats = {
  relationIdsInserted: string[];
  metaIdsInserted: { nodeIds: string[]; relationIds: string[] };
  nodeIdsInserted: string[];
  existingNodesCount: number;
  newNodesCount: number;
  existingConnectionCount: number;
  newConnectionsCount: number;
  queryNodeId: string;
  nodeIdsExisting: string[];
  nodeIdToRelevancy: Record<string, string>;
};

export type AiSearchQueryResponse = {
  aiGraph: AiGraph;
  stats: AiSearchStats;
};
