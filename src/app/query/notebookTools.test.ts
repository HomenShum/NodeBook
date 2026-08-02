import type { GraphStore } from "@/app/graph/GraphStore";

import { applyAgentOperations, undoAgentOperations } from "./applyProposal";
import { createNotebookTools } from "./notebookTools";

jest.mock("./applyProposal", () => ({
  applyAgentOperations: jest.fn(),
  undoAgentOperations: jest.fn(),
}));

const checkpoint = { id: "proposal-1", digest: "digest-1" };
const operation = {
  kind: "create_node" as const,
  nodeId: null,
  parentId: "root",
  newParentId: null,
  fromNodeId: null,
  toNodeId: null,
  relationType: "child" as const,
  tempId: "note-1",
  content: "Proof",
  newContent: null,
  reason: "Scenario proof",
};
const receipt = { appliedUpdates: [{}], inverseUpdates: [{}] };

describe("NodeBook NotebookTools conflict boundary", () => {
  beforeEach(() => jest.clearAllMocks());

  test("two signed tabs racing one checkpoint receive one success and one typed conflict without corrupting the winner", async () => {
    let status = "pending";
    const transition = jest.fn(async (body: Record<string, unknown>) => {
      if (body.action === "accept") {
        await Promise.resolve();
        if (status !== "pending") throw new Error(`Proposal is already ${status}`);
        status = "accepted";
        return { operations: [operation] };
      }
      if (body.action === "applied") status = "applied";
      if (body.action === "failed") status = "failed";
      return {};
    });
    jest.mocked(applyAgentOperations).mockResolvedValue(receipt as never);
    const tools = createNotebookTools({ graphStore: {} as GraphStore, transition });

    const outcomes = await Promise.all([tools.executeCheckpoint(checkpoint), tools.executeCheckpoint(checkpoint)]);

    expect(outcomes.filter((result) => result.ok)).toHaveLength(1);
    expect(outcomes.filter((result) => !result.ok)).toEqual([{
      ok: false,
      conflict: { code: "checkpoint_conflict", message: "Proposal is already accepted", retryable: false },
    }]);
    expect(applyAgentOperations).toHaveBeenCalledTimes(1);
    expect(transition).not.toHaveBeenCalledWith(expect.objectContaining({ action: "failed" }));
    expect(status).toBe("applied");
  });

  test("a graph synchronization outage becomes retryable conflict data and records the accepted checkpoint failure", async () => {
    const transition = jest.fn(async (body: Record<string, unknown>) => body.action === "accept" ? { operations: [operation] } : {});
    jest.mocked(applyAgentOperations).mockRejectedValue(new Error("Durable graph sync timed out"));
    const tools = createNotebookTools({ graphStore: {} as GraphStore, transition });

    const result = await tools.executeCheckpoint(checkpoint);

    expect(result).toEqual({
      ok: false,
      conflict: { code: "persistence_failure", message: "Durable graph sync timed out", retryable: true },
    });
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ action: "failed", error: "Durable graph sync timed out" }));
  });

  test("an undo refuses a post-checkpoint user edit and never claims the durable rollback", async () => {
    const transition = jest.fn(async () => ({}));
    jest.mocked(undoAgentOperations).mockRejectedValue(new Error("Rollback cannot restore node note-1; it changed after the checkpoint."));
    const tools = createNotebookTools({ graphStore: {} as GraphStore, transition });

    const result = await tools.undoCheckpoint(checkpoint, [{}] as never[]);

    expect(result).toEqual({
      ok: false,
      conflict: {
        code: "source_conflict",
        message: "Rollback cannot restore node note-1; it changed after the checkpoint.",
        retryable: false,
      },
    });
    expect(transition).not.toHaveBeenCalled();
  });
});
