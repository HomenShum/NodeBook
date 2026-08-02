# NodeAgent graph renderer decision

Date: 2026-08-02

## Decision

Use `@xyflow/react` (React Flow) for NodeBook's bounded, interactive NodeAgent synapse and mind-map surfaces. Do not hand-author SVG graph renderers and do not add a second graph rendering dependency for the current product scope.

The production boundary is `src/app/query/RuntimeSynapseMap.tsx`. Its regression test requires a React Flow import/render and rejects a literal `<svg>` implementation.

## Why this fits NodeBook

- NodeBook is a React application and needs graph nodes to contain normal interactive React UI, receipts, statuses, tooltips, and future inline actions.
- React Flow provides node dragging, viewport controls, selection, minimaps, custom React nodes, keyboard navigation, ARIA labels, and screen-reader support.
- The current runtime graph is deliberately bounded to six visible evaluation cases, so DOM-based React nodes are a better product fit than a second canvas/WebGL stack.
- The repository already pins `@xyflow/react` 12.11.2 and ships a library-rendered graph boundary.

## Alternatives considered

| Library | Strength | Decision boundary |
| --- | --- | --- |
| React Flow | React-native node editors and interactive diagrams; accessible DOM nodes | Selected for NodeAgent workflows, mind maps, and editable knowledge projections |
| Cytoscape.js | Graph-theory algorithms, compound graphs, rich layout/plugin ecosystem | Reconsider only if client-side graph analysis becomes a primary product requirement |
| Sigma.js + Graphology | WebGL rendering for thousands of nodes and edges | Reconsider when measured production graphs exceed the bounded React Flow performance budget |

## Escalation rule

Stay on React Flow while the visible graph is at most 500 nodes / 1,500 edges and interaction remains within the agreed mobile/desktop frame budget. Benchmark the real NodeBook graph before crossing that boundary. If it fails, evaluate Sigma for a read-only overview layer while preserving React Flow for editable workflow detail; do not migrate by intuition alone.

## Primary references

- React Flow: https://reactflow.dev/
- React Flow accessibility: https://reactflow.dev/learn/advanced-use/accessibility
- React Flow layout options: https://reactflow.dev/learn/layouting/layouting
- Cytoscape.js: https://js.cytoscape.org/
- Sigma.js: https://www.sigmajs.org/docs/
