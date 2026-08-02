# NodeAgent memory and synapse visual contract

Date: 2026-08-02
Production reference viewport: 2560 x 1431, DPR 1

## Locked boundaries

- **A - Existing NodeAgent surface:** preserve the original NodeBook outline and keep agent controls in the embedded right rail.
- **B - Memory empty to populated:** the empty state adds no decorative placeholder. After a run recalls memory, bounded cards appear in the result rail with Inspect, Pin/Unpin, Add to graph, and Forget actions.
- **C - Optional synapse view:** the notebook outline stays the default. A user opens a graph view on demand over the central canvas; it is rendered by `@xyflow/react`, not a custom SVG implementation.
- **D - Memory to graph handoff:** Add to graph creates a cited, reversible notebook projection. Opening the synapse view is a separate visual action and does not silently mutate the notebook.

## Acceptance states

### Before / empty

- The original outline remains the dominant canvas.
- NodeAgent controls and the current run receipt remain in the right rail.
- No recalled-memory section is rendered when the run returns zero memories.

### After / populated

- Each memory card names its task class, summary, outcome, tool sequence, sources, and pinned state.
- Actions have explicit accessible names and visible pending/error feedback.
- Inspect reveals provenance without exposing hidden prompt transcripts.
- Add to graph uses the existing checkpoint/apply/undo path.
- The optional React Flow view highlights cited nodes and relations; it does not replace the outline by default.

## Library decision

Retain `@xyflow/react` 12.11.2 as the graph interaction and rendering foundation. Reuse its nodes, edges, viewport controls, selection, fit-view, and accessibility primitives. Do not add a hand-authored SVG graph renderer.
