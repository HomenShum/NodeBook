export type AgentMode = "ask" | "agent" | "organize";
export type AgentExecutionMode = "auto" | "plan";

export type AgentOperation = {
  kind:
    | "create_node"
    | "update_node_content"
    | "delete_node"
    | "move_node"
    | "add_relation"
    | "clone_node_hierarchy";
  nodeId: string | null;
  parentId: string | null;
  newParentId: string | null;
  fromNodeId: string | null;
  toNodeId: string | null;
  relationType: "child" | "relatedTo" | "hashtag" | "author" | null;
  tempId: string | null;
  content: string | null;
  newContent: string | null;
  reason: string;
};

export type AgentStep = {
  sequence: number;
  tool: string;
  status: "completed" | "failed" | "repaired";
  summary: string;
};

export type AgentReceipt = {
  runId: string;
  status: "completed" | "proposed";
  provider: "openai" | "openrouter";
  model: string;
  mode: AgentMode;
  startedAt: string;
  completedAt: string;
  sourceNodeIds: string[];
  sourceBindings: Array<{ sourceId: string; version: number; digest: string }>;
  sourceUrls: string[];
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  persisted: boolean;
};

export type AgentQueryResponse =
  | {
      status: "completed" | "proposed";
      content: string;
      understanding: string;
      plan: string[];
      operations: AgentOperation[];
      proposal: { id: string; digest: string; status: "pending" } | null;
      execution: {
        mode: AgentExecutionMode;
        disposition: "read_only" | "auto_apply" | "approval_required" | "preview_only";
        risk: { level: "low" | "high"; requiresApproval: boolean; reasons: string[] };
      };
      memory: {
        memories: Array<{
          memoryId: string;
          taskClass: string;
          summary: string;
          toolSequence: string[];
          outcome: "success" | "failure" | "rejected" | "undone";
          sourceNodeIds: string[];
          pinned: boolean;
        }>;
        patterns: Array<{
          taskClass: string;
          toolSequence: string[];
          successCount: number;
          failureCount: number;
          successRate: number;
          averageDurationMs: number;
          useCount: number;
        }>;
      };
      steps: AgentStep[];
      receipt: AgentReceipt;
    }
  | { error: string };

export type DurableAgentProposal = {
  id: string;
  digest: string;
  status: "pending" | "accepted" | "applied" | "rejected" | "failed" | "undone";
  mode: Exclude<AgentMode, "ask">;
  understanding: string;
  plan: string[];
  summary: string;
  operations: AgentOperation[];
  inverseUpdates: unknown[] | null;
  error: string | null;
  executionMode: AgentExecutionMode;
  riskReasons: string[];
  steps: AgentStep[];
  receipt: AgentReceipt;
};
