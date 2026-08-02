import type { AgentQueryResponse, AgentStep } from "./types";

export type NodeAgentStreamEvent =
  | { type: "thought"; data: { message: string } }
  | { type: "tool_call"; data: { name: string } }
  | { type: "tool_result"; data: { name: string; success: boolean; step: AgentStep } }
  | { type: "client_action"; data: { proposalId: string; operationCount: number; disposition: string } }
  | { type: "final_summary"; data: { result: AgentQueryResponse } }
  | { type: "error"; data: { message: string } }
  | { type: "end"; data: { status: "completed" | "failed" } };

const MAX_STREAM_BUFFER_CHARS = 1_000_000;

export function encodeNodeAgentEvent(event: NodeAgentStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseNodeAgentEventFrames(buffer: string) {
  if (buffer.length > MAX_STREAM_BUFFER_CHARS) throw new Error("NodeAgent stream exceeded its buffer limit");
  const normalized = buffer.replaceAll("\r\n", "\n");
  const frames = normalized.split("\n\n");
  const rest = frames.pop() ?? "";
  const events: NodeAgentStreamEvent[] = [];
  for (const frame of frames) {
    const payload = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!payload || payload === "[DONE]") continue;
    const event = JSON.parse(payload) as NodeAgentStreamEvent;
    if (!event || typeof event !== "object" || typeof event.type !== "string" || !("data" in event)) {
      throw new Error("NodeAgent stream returned an invalid event");
    }
    events.push(event);
  }
  return { events, rest };
}

export async function consumeNodeAgentEventStream(
  response: Response,
  onEvent: (event: NodeAgentStreamEvent) => void | Promise<void>,
) {
  if (!response.body) throw new Error("NodeAgent stream did not include a response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const parsed = parseNodeAgentEventFrames(buffer);
      buffer = parsed.rest;
      for (const event of parsed.events) await onEvent(event);
      if (done) break;
    }
    if (buffer.trim()) throw new Error("NodeAgent stream ended with an incomplete event");
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
