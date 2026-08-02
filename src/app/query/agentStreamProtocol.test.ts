import { ReadableStream as NodeReadableStream } from "stream/web";
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from "util";

import { consumeNodeAgentEventStream, encodeNodeAgentEvent, parseNodeAgentEventFrames } from "./agentStreamProtocol";

describe("NodeAgent progressive event protocol", () => {
  test("a mobile user receives fragmented legacy-compatible events without losing frame boundaries", () => {
    const first = encodeNodeAgentEvent({ type: "thought", data: { message: "Reviewing notebook context" } });
    const second = encodeNodeAgentEvent({
      type: "end",
      data: { status: "completed" },
    });
    const splitAt = first.length + Math.floor(second.length / 2);
    const wire = first + second;

    const initial = parseNodeAgentEventFrames(wire.slice(0, splitAt));
    expect(initial.events).toEqual([{ type: "thought", data: { message: "Reviewing notebook context" } }]);
    expect(initial.rest).not.toBe("");

    const completed = parseNodeAgentEventFrames(initial.rest + wire.slice(splitAt));
    expect(completed.events).toEqual([{ type: "end", data: { status: "completed" } }]);
    expect(completed.rest).toBe("");
  });

  test("an endless or hostile stream is stopped by the client buffer bound", () => {
    expect(() => parseNodeAgentEventFrames("x".repeat(1_000_001))).toThrow("buffer limit");
  });

  test("a sustained reader preserves event order across arbitrary network chunks", async () => {
    const encoder = new NodeTextEncoder();
    const wire = [
      encodeNodeAgentEvent({ type: "thought", data: { message: "Loading context" } }),
      encodeNodeAgentEvent({ type: "tool_call", data: { name: "find_nodes" } }),
      encodeNodeAgentEvent({ type: "end", data: { status: "completed" } }),
    ].join("");
    const response = {
      body: new NodeReadableStream({
        start(controller) {
          for (let index = 0; index < wire.length; index += 7)
            controller.enqueue(encoder.encode(wire.slice(index, index + 7)));
          controller.close();
        },
      }),
    } as unknown as Response;
    const observed: string[] = [];
    const originalDecoder = globalThis.TextDecoder;
    Object.assign(globalThis, { TextDecoder: NodeTextDecoder });
    try {
      await consumeNodeAgentEventStream(response, (event) => {
        observed.push(event.type);
      });
    } finally {
      Object.assign(globalThis, { TextDecoder: originalDecoder });
    }

    expect(observed).toEqual(["thought", "tool_call", "end"]);
  });
});
