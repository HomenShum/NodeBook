export type AgentReceipt = {
  runId: string;
  status: "completed";
  provider: "openai";
  model: string;
  mode: "read-only";
  startedAt: string;
  completedAt: string;
  sourceNodeIds: string[];
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  persisted: boolean;
};

export type AgentQueryResponse =
  | { status: "completed"; content: string; receipt: AgentReceipt }
  | { error: string };
