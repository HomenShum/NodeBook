import React from "react";

import { RuntimeCaseStatus, RuntimeEvalCase } from "./runtimeVerificationState";

import styles from "./page.module.css";

const POSITIONS = [
  { x: 48, y: 38 },
  { x: 160, y: 22 },
  { x: 272, y: 38 },
  { x: 272, y: 142 },
  { x: 160, y: 158 },
  { x: 48, y: 142 },
] as const;

export default function RuntimeSynapseMap({
  cases,
  statusForCase,
}: {
  cases: RuntimeEvalCase[];
  statusForCase: (caseId: string) => RuntimeCaseStatus;
}) {
  const statusSummary = cases.map((testCase) => `${testCase.title}: ${statusForCase(testCase.caseId)}`).join("; ");

  return <figure className={styles.runtimeMap} data-testid="runtime-eval-map">
    <svg viewBox="0 0 320 180" role="img" aria-labelledby="runtime-map-title runtime-map-description">
      <title id="runtime-map-title">NodeAgent legacy-parity runtime map</title>
      <desc id="runtime-map-description">NodeAgent connects to six locked cases. {statusSummary}</desc>
      {cases.slice(0, POSITIONS.length).map((testCase, index) => {
        const position = POSITIONS[index];
        const status = statusForCase(testCase.caseId);
        const edgeStateClass = status === "idle" ? "" : styles[`runtimeMapEdge_${status}`];
        const nodeStateClass = status === "idle" ? "" : styles[`runtimeMapNode_${status}`];
        return <g key={testCase.caseId} data-status={status}>
          <line className={`${styles.runtimeMapEdge} ${edgeStateClass}`} x1="160" y1="90" x2={position.x} y2={position.y} />
          <circle className={`${styles.runtimeMapNode} ${nodeStateClass}`} cx={position.x} cy={position.y} r="13" />
          <text className={styles.runtimeMapIndex} x={position.x} y={position.y + 4} textAnchor="middle">{index + 1}</text>
        </g>;
      })}
      <circle className={styles.runtimeMapCoreHalo} cx="160" cy="90" r="29" />
      <circle className={styles.runtimeMapCore} cx="160" cy="90" r="22" />
      <text className={styles.runtimeMapCoreLabel} x="160" y="87" textAnchor="middle">NODE</text>
      <text className={styles.runtimeMapCoreLabel} x="160" y="99" textAnchor="middle">AGENT</text>
    </svg>
    <figcaption><span><i data-status="running" />Running</span><span><i data-status="passed" />Pass</span><span><i data-status="failed" />Fail</span><span><i data-status="idle" />Not run</span></figcaption>
  </figure>;
}
