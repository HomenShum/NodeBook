# NodeAgent runtime verification

## 2026-08-02 — Fit the graph after its disclosure opens
Let React own the summary toggle and mount React Flow only after the runtime disclosure has a visible container, preventing both native-toggle races and a zero-size first measurement from translating the graph off-canvas.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `evidence/nodeagent-live-eval-ui-20260802/pre-fix-react-flow-closed-container.png`

## 2026-08-02 — Replace the graph spike with React Flow
Remove the hand-authored SVG renderer and use the MIT-licensed React Flow 12 standard node, edge, viewport, fit-view, focus, and accessibility primitives. Keep its handle geometry for edge routing but make the read-only ports transparent; bound the graph to seven nodes and six receipt-derived edges.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `evidence/nodeagent-live-eval-ui-20260802/graph-library-decision.md`

## 2026-08-02 — Keep SVG evidence legible in NodeBook themes
Use NodeBook's defined gray scale for idle node fills and the NodeAgent core label so the relationship map does not fall back to black-on-black SVG defaults.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `design-dna/observations/nodeagent-runtime-verification.yml`

## 2026-08-02 — Expose receipt-backed legacy parity verification
Add an authenticated, reload-restorable six-case verification disclosure to the existing NodeAgent sidebar. A compact synapse map highlights only the active case or durable PASS/FAIL receipts, while the exact case list, actual model, usage, latency, reasons, and receipt IDs remain available as text. The visual hierarchy cites live Mobbin design-DNA observations without storing reference pixels.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/server/nodeagent-runtime-evals.md`, `CHANGELOG/db/agent-runtime-evaluations.md`
