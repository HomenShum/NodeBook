import { GraphStore } from "@/app/graph/GraphStore";
import { GraphUpdate } from "@/app/graph/GraphUpdate";

import { applyAgentOperations, undoAgentOperations } from "./applyProposal";
import { runCheckpointExecutionLifecycle } from "./checkpointExecution";
import { AgentOperation } from "./types";

export type NotebookCheckpoint = { id: string; digest: string };

export type NotebookToolConflict = {
  code: "checkpoint_conflict" | "source_conflict" | "persistence_failure" | "execution_failure";
  message: string;
  retryable: boolean;
};

export type NotebookToolResult<T> =
  | { ok: true; value: T }
  | { ok: false; conflict: NotebookToolConflict };

export type NotebookAppliedReceipt = {
  appliedUpdates: GraphUpdate[];
  inverseUpdates: GraphUpdate[];
};

type ProposalTransition = (body: Record<string, unknown>) => Promise<unknown>;

export type NotebookTools = {
  executeCheckpoint: (checkpoint: NotebookCheckpoint) => Promise<NotebookToolResult<NotebookAppliedReceipt>>;
  rejectCheckpoint: (checkpoint: NotebookCheckpoint) => Promise<NotebookToolResult<void>>;
  undoCheckpoint: (checkpoint: NotebookCheckpoint, inverseUpdates: GraphUpdate[]) => Promise<NotebookToolResult<{ warnings: string[] }>>;
};

function conflictFrom(error: unknown): NotebookToolConflict {
  const message = error instanceof Error ? error.message : "Notebook operation failed";
  if (/already (?:accepted|applied|rejected|failed|undone)|already handled|checkpoint is already|proposal is already/i.test(message)) {
    return { code: "checkpoint_conflict", message, retryable: false };
  }
  if (/changed after the checkpoint|source binding|digest|mismatch|no longer exists|original endpoint is missing/i.test(message)) {
    return { code: "source_conflict", message, retryable: false };
  }
  if (/sync|durable|network|fetch|timeout|temporarily unavailable/i.test(message)) {
    return { code: "persistence_failure", message, retryable: true };
  }
  return { code: "execution_failure", message, retryable: false };
}

function failure(error: unknown): NotebookToolResult<never> {
  return { ok: false, conflict: conflictFrom(error) };
}

export function createNotebookTools({
  graphStore,
  transition,
}: {
  graphStore: GraphStore;
  transition: ProposalTransition;
}): NotebookTools {
  return {
    async executeCheckpoint(checkpoint) {
      try {
        const receipt = await runCheckpointExecutionLifecycle({
          accept: async () => transition({
            action: "accept",
            proposalId: checkpoint.id,
            proposalDigest: checkpoint.digest,
          }) as Promise<{ operations: AgentOperation[] }>,
          apply: (operations) => applyAgentOperations(graphStore, operations),
          markApplied: (receipt) => transition({
            action: "applied",
            proposalId: checkpoint.id,
            proposalDigest: checkpoint.digest,
            ...receipt,
          }).then(() => undefined),
          markFailed: (message) => transition({
            action: "failed",
            proposalId: checkpoint.id,
            proposalDigest: checkpoint.digest,
            error: message,
          }).then(() => undefined),
        });
        return { ok: true, value: receipt as NotebookAppliedReceipt };
      } catch (error) {
        return failure(error);
      }
    },

    async rejectCheckpoint(checkpoint) {
      try {
        await transition({ action: "reject", proposalId: checkpoint.id, proposalDigest: checkpoint.digest });
        return { ok: true, value: undefined };
      } catch (error) {
        return failure(error);
      }
    },

    async undoCheckpoint(checkpoint, inverseUpdates) {
      try {
        const rollback = await undoAgentOperations(graphStore, inverseUpdates);
        await transition({ action: "undo", proposalId: checkpoint.id, proposalDigest: checkpoint.digest });
        return { ok: true, value: rollback };
      } catch (error) {
        return failure(error);
      }
    },
  };
}

