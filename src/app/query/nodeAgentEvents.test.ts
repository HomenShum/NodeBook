import { parseNodeAgentCommand } from "./nodeAgentEvents";

describe("NodeAgent inline command", () => {
  test.each([
    ["/nodeagent Research Web3 and its core components", "Research Web3 and its core components"],
    ["  /NodeAgent organize my meeting notes  ", "organize my meeting notes"],
    ["/mewagent connect Mamba architecture and State Space Models", "connect Mamba architecture and State Space Models"],
  ])("an existing notebook user invokes the agent from the current node with %s", (input, query) => {
    expect(parseNodeAgentCommand(input)).toBe(query);
  });

  test.each(["/nodeagent", "nodeagent research", "/nodeagent   ", "prefix /nodeagent research"])(
    "ordinary note text is not consumed as a command: %s",
    (input) => expect(parseNodeAgentCommand(input)).toBeNull(),
  );
});
