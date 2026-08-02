export type AgentRequestIdentity = { requestId: string; fingerprint: string };

export function agentRequestFingerprint(input: {
  query: string;
  mode: string;
  executionMode: string;
  webResearch: boolean;
  rootNodeId?: string;
}) {
  return JSON.stringify({
    query: input.query,
    mode: input.mode,
    executionMode: input.executionMode,
    webResearch: input.webResearch,
    rootNodeId: input.rootNodeId ?? null,
  });
}

export function nextAgentRequestIdentity(
  previous: AgentRequestIdentity | null,
  fingerprint: string,
  generate: () => string = () => crypto.randomUUID(),
): AgentRequestIdentity {
  if (previous?.fingerprint === fingerprint) return previous;
  return { requestId: generate(), fingerprint };
}
