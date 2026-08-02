import { Edge, Node, ReactFlow } from "@xyflow/react";
import React, { useMemo } from "react";

import { RuntimeCaseStatus, RuntimeEvalCase } from "./runtimeVerificationState";

import "@xyflow/react/dist/base.css";
import styles from "./page.module.css";

const POSITIONS = [
  { x: 16, y: 22 },
  { x: 144, y: 2 },
  { x: 272, y: 22 },
  { x: 272, y: 126 },
  { x: 144, y: 146 },
  { x: 16, y: 126 },
] as const;

export default function RuntimeSynapseMap({
  cases,
  statusForCase,
}: {
  cases: RuntimeEvalCase[];
  statusForCase: (caseId: string) => RuntimeCaseStatus;
}) {
  const graph = useMemo(() => {
    const visibleCases = cases.slice(0, POSITIONS.length);
    const nodes: Node[] = [
      {
        id: "nodeagent",
        type: "default",
        position: { x: 132, y: 61 },
        data: { label: <><span>NODE</span><span>AGENT</span></> },
        className: `${styles.runtimeFlowNode} ${styles.runtimeFlowNodeCore}`,
        draggable: false,
        selectable: false,
        focusable: true,
        ariaLabel: "NodeAgent",
        ariaRole: "img",
      },
      ...visibleCases.map((testCase, index): Node => {
        const status = statusForCase(testCase.caseId);
        const stateClass = status === "idle" ? "" : styles[`runtimeFlowNode_${status}`];
        return {
          id: `case-${testCase.caseId}`,
          type: "default",
          position: POSITIONS[index],
          data: { label: index + 1 },
          className: `${styles.runtimeFlowNode} ${stateClass}`,
          draggable: false,
          selectable: false,
          focusable: true,
          ariaLabel: `${testCase.title}: ${status}`,
          ariaRole: "img",
        };
      }),
    ];
    const edges: Edge[] = visibleCases.map((testCase) => {
      const status = statusForCase(testCase.caseId);
      const stateClass = status === "idle" ? "" : styles[`runtimeFlowEdge_${status}`];
      return {
        id: `nodeagent-${testCase.caseId}`,
        source: "nodeagent",
        target: `case-${testCase.caseId}`,
        type: "straight",
        className: `${styles.runtimeFlowEdge} ${stateClass}`,
        focusable: false,
        selectable: false,
        ariaLabel: `${testCase.title} connection: ${status}`,
      };
    });
    return { nodes, edges };
  }, [cases, statusForCase]);

  return <figure className={styles.runtimeMap} data-testid="runtime-eval-map">
    <div className={styles.runtimeFlowCanvas}>
      <ReactFlow
        aria-label="NodeAgent legacy-parity runtime map"
        nodes={graph.nodes}
        edges={graph.edges}
        fitView
        fitViewOptions={{ padding: 0.12, minZoom: 0.8, maxZoom: 1.35 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        autoPanOnNodeFocus={false}
        proOptions={{ hideAttribution: true }}
      />
    </div>
    <figcaption><span><i data-status="running" />Running</span><span><i data-status="passed" />Pass</span><span><i data-status="failed" />Fail</span><span><i data-status="idle" />Not run</span></figcaption>
  </figure>;
}
