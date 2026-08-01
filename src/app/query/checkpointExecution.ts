import { AgentOperation } from "./types";

type AppliedReceipt = {
  appliedUpdates: unknown[];
  inverseUpdates: unknown[];
};

type CheckpointExecutionDependencies = {
  accept: () => Promise<{ operations: AgentOperation[] }>;
  apply: (operations: AgentOperation[]) => Promise<AppliedReceipt>;
  markApplied: (receipt: AppliedReceipt) => Promise<void>;
  markFailed: (message: string) => Promise<void>;
};

export async function runCheckpointExecutionLifecycle({
  accept,
  apply,
  markApplied,
  markFailed,
}: CheckpointExecutionDependencies): Promise<AppliedReceipt> {
  let acceptedByThisClient = false;
  try {
    const accepted = await accept();
    acceptedByThisClient = true;
    const receipt = await apply(accepted.operations);
    await markApplied(receipt);
    return receipt;
  } catch (error) {
    if (acceptedByThisClient) {
      const message = error instanceof Error ? error.message : "Apply failed";
      try {
        await markFailed(message);
      } catch {
        // The original failure remains authoritative and visible.
      }
    }
    throw error;
  }
}
