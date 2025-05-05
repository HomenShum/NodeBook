export enum QueryMode {
  CREATE,
  READ,
}

export type ReadQueryResponse = {
  response: string;
  error?: string;
};

type CreatedAiNodeId = number;

export type CreatedAiNode = {
  id: CreatedAiNodeId;
  label: string;
  whyRelevant: string;
};

export type CreatedAiEdge = {
  from: CreatedAiNodeId;
  to: CreatedAiNodeId;
  relationship: string;
};

export type CreatedAiGraphResponse = {
  nodes: CreatedAiNode[];
  edges: CreatedAiEdge[];
};

export type ReadResponseLine =
  | { type: "text"; content: string }
  | { type: "citation"; nodeId: string }
  | { type: "link"; url: string; content: string };
export type ReadParsedResponse = ReadResponseLine[][];
