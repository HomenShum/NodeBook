export const NODE_AGENT_INVOKE_EVENT = "nodebook:nodeagent-invoke";

export type NodeAgentInvocation = {
  query: string;
  currentNodeId: string;
};

export function parseNodeAgentCommand(text: string): string | null {
  const match = text.trim().match(/^\/nodeagent\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function invokeNodeAgent(detail: NodeAgentInvocation) {
  window.dispatchEvent(new CustomEvent<NodeAgentInvocation>(NODE_AGENT_INVOKE_EVENT, { detail }));
}
