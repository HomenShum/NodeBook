import { agentRequestFingerprint, nextAgentRequestIdentity } from "./requestIdentity";

describe("NodeAgent retry identity", () => {
  const request = { query: "Organize launch notes", mode: "agent", executionMode: "auto", webResearch: false, rootNodeId: "root" };

  test("a network retry reuses one trace while changed user intent creates a new trace", () => {
    let sequence = 0;
    const generate = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
    const fingerprint = agentRequestFingerprint(request);
    const first = nextAgentRequestIdentity(null, fingerprint, generate);
    const retry = nextAgentRequestIdentity(first, fingerprint, generate);
    const changed = nextAgentRequestIdentity(retry, agentRequestFingerprint({ ...request, query: "Organize roadmap notes" }), generate);

    expect(retry).toBe(first);
    expect(changed.requestId).not.toBe(first.requestId);
    expect(sequence).toBe(2);
  });
});
