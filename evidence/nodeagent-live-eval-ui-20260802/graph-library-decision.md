# NodeAgent graph renderer decision

Decision date: 2026-08-02

Selected: `@xyflow/react` 12.11.2 (React Flow 12, MIT)

## Decision matrix

| Candidate | Strength | Mismatch for this surface | Decision |
| --- | --- | --- | --- |
| React Flow | React-native nodes, built-in edges/viewport/fit-view, keyboard and screen-reader support, SSR support, MIT | More package weight than a six-node custom spike | Select: best path from six status nodes to interactive NodeBook memory/traversal views |
| Cytoscape.js | Mature graph analysis, selectors, layouts, algorithms, touch gestures, MIT | Imperative integration and analysis surface exceed the current receipt-view need; npm unpacked size is about 5.7 MB | Revisit for client-side graph algorithms, not this UI |
| Sigma.js | WebGL renderer for thousands to tens of thousands of nodes, Graphology ecosystem, MIT | Canvas/WebGL semantics and lifecycle are disproportionate for six accessible status nodes | Revisit only for very large graph exploration |
| Existing D3/d3-force | Already transitive in NodeBook and suitable for layout math | Still leaves us owning renderer, focus model, viewport, hit testing, and accessibility | Reject for the production renderer |

## Primary evidence

- React Flow accessibility: https://reactflow.dev/learn/advanced-use/accessibility
- React Flow performance guidance: https://reactflow.dev/learn/advanced-use/performance
- React Flow MIT repository and package: https://github.com/xyflow/xyflow
- Cytoscape.js official factsheet/API: https://js.cytoscape.org/
- Sigma.js official renderer scope: https://www.sigmajs.org/docs/
- Package metadata checked with npm registry: React Flow 12.11.2 / 1,208,222 unpacked bytes; Cytoscape.js 3.34.0 / 5,696,647; Sigma 3.0.3 / 970,733.

## Production constraints

- Exactly seven nodes and six edges for the locked runtime suite.
- Read-only: no drag, connect, select, pan, zoom, or delete behavior.
- Nodes stay keyboard-focusable with exact status labels; edges are not focus stops.
- Edge state is derived only from the current in-flight case or a durable receipt.
- Exact textual case receipts remain the non-visual evidence surface.
- React Flow arrays and status callback are memoized; no animated edges or decorative activity.
