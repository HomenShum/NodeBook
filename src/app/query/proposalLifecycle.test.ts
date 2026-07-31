import { runProposalApplyLifecycle } from "./proposalLifecycle";

const operation = {
  kind: "create_node" as const,
  nodeId: null,
  parentId: "root",
  newParentId: null,
  fromNodeId: null,
  toNodeId: null,
  relationType: "child" as const,
  tempId: "temporary-race-note",
  content: "Concurrent transition proof",
  newContent: null,
  reason: "Live two-tab production validation",
};

describe("proposal apply lifecycle", () => {
  test("two authenticated tabs racing one pending proposal produce one write and never let the loser mark the winner failed", async () => {
    let status: "pending" | "accepted" | "applied" | "failed" = "pending";
    let writes = 0;
    let failedTransitions = 0;

    const actor = () => runProposalApplyLifecycle({
      accept: async () => {
        await Promise.resolve();
        if (status !== "pending") throw new Error(`Proposal is already ${status}`);
        status = "accepted";
        return { operations: [operation] };
      },
      apply: async () => {
        writes += 1;
        return { appliedUpdates: [{}], inverseUpdates: [{}] };
      },
      markApplied: async () => { status = "applied"; },
      markFailed: async () => {
        failedTransitions += 1;
        status = "failed";
      },
    });

    const outcomes = await Promise.allSettled([actor(), actor()]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(writes).toBe(1);
    expect(failedTransitions).toBe(0);
    expect(status).toBe("applied");
  });

  test("an accepted actor whose local graph write fails records one honest durable failure", async () => {
    const markFailed = jest.fn(async () => undefined);

    await expect(runProposalApplyLifecycle({
      accept: async () => ({ operations: [operation] }),
      apply: async () => { throw new Error("Graph synchronization failed"); },
      markApplied: async () => undefined,
      markFailed,
    })).rejects.toThrow("Graph synchronization failed");

    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(markFailed).toHaveBeenCalledWith("Graph synchronization failed");
  });
});
