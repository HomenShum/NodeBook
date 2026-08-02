import { readFileSync } from "fs";
import path from "path";

import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import RuntimeSynapseMap from "./RuntimeSynapseMap";

const reactFlowSpy = jest.fn();

jest.mock("@xyflow/react", () => ({
  ReactFlow: (props: unknown) => {
    reactFlowSpy(props);
    return jest.requireActual("react").createElement("div", { "data-testid": "react-flow-canvas" });
  },
}));

describe("NodeAgent runtime graph renderer boundary", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    reactFlowSpy.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("an owner opening an oversized parity suite gets a bounded React Flow graph with status-labelled nodes and edges", () => {
    const cases = Array.from({ length: 8 }, (_, index) => ({
      caseId: `case-${index + 1}`,
      title: `Workflow ${index + 1}`,
    }));

    act(() => {
      root.render(
        <RuntimeSynapseMap
          cases={cases}
          statusForCase={(caseId) => caseId === "case-1" ? "passed" : "idle"}
        />,
      );
    });

    expect(container.querySelector('[data-testid="react-flow-canvas"]')).not.toBeNull();
    expect(reactFlowSpy).toHaveBeenCalledTimes(1);
    const props = reactFlowSpy.mock.calls[0][0] as {
      nodes: Array<{ id: string; ariaLabel?: string }>;
      edges: Array<{ source: string; target: string; ariaLabel?: string }>;
      fitView: boolean;
      nodesDraggable: boolean;
    };
    expect(props.nodes).toHaveLength(7);
    expect(props.edges).toHaveLength(6);
    expect(props.nodes.find((node) => node.id === "case-case-1")?.ariaLabel).toBe("Workflow 1: passed");
    expect(props.edges[0]).toMatchObject({
      source: "nodeagent",
      target: "case-case-1",
      ariaLabel: "Workflow 1 connection: passed",
    });
    expect(props.fitView).toBe(true);
    expect(props.nodesDraggable).toBe(false);
  });

  test("a visual refresh cannot replace the graph renderer with hand-authored SVG", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/query/RuntimeSynapseMap.tsx"), "utf8");

    expect(source).toContain('from "@xyflow/react"');
    expect(source).toContain("<ReactFlow");
    expect(source).not.toMatch(/<svg\b/i);
  });
});
