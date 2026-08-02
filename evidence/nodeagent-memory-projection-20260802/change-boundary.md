# NodeAgent typed-memory projection change boundary

Date: 2026-08-02

## Capture identity

- Route: signed production owner-root notebook with a reloaded durable proposal receipt.
- Viewport: 2560 x 1431 CSS pixels, DPR 1.
- Theme: current production light theme.
- Session: existing authenticated Chrome session.
- Trigger state: durable knowledge-map proposal reloaded after Undo; recalled-memory section is absent.
- `before.png` is the untouched browser capture. `change-boundary.png` uses that exact bitmap as its background and adds only deterministic CSS boxes.

## CHANGE A - Recalled memory cards

- Current: no section is rendered when a response has no recalled memories; populated cards show only task class, summary, outcome, tool sequence, Pin, Add to graph, and Forget.
- Expected: a bounded card exposes provenance through an explicit Inspect control; Pin/Unpin and Forget keep honest per-card pending/error feedback; Add to graph creates a durable checkpoint instead of writing directly.
- Trigger: a completed run returns one or more typed memories.
- Data: owner-scoped Convex `agentMemories`, capped by the existing recall limit.
- Empty: render nothing; no decorative placeholder displaces the original notebook UI.
- Loading: disable only the affected card action and announce the action in progress.
- Error: preserve the card, report `Not completed`, and provide a retryable action.
- Populated: task, summary, outcome, tools, recorded time/duration, source count, and inspectable evidence.
- Overflow: summaries wrap; tools and citations remain bounded; the right rail does not grow horizontally.
- Responsive: actions wrap on narrow widths without hiding labels.

## CHANGE B - Projected memory node

- Current: Add to graph performs an immediate summary-only GraphStore child write.
- Expected: one human-readable memory note is created under the current root and related to a bounded set of exact cited source nodes.
- Trigger: Add to graph on one recalled-memory card.
- Data: the exact owner-scoped typed memory plus an authoritative current binding snapshot for the target root and cited sources.
- Empty: disabled if the current root or memory no longer exists.
- Loading: no optimistic node; creation begins only after the durable checkpoint is accepted.
- Error: no partial graph residue; the checkpoint is failed honestly.
- Populated: summary, task class, outcome, tool sequence, recorded time, and human-readable evidence titles.
- Overflow: at most 12 related source links and a bounded node body.
- Responsive: the created node behaves exactly like existing outline nodes.

## CHANGE C - Checkpoint receipt and Undo

- Current: memory projection has no proposal, receipt, status, or whole-action Undo.
- Expected: deterministic internal run identity, checkpointed operations, applied receipt, and Undo this run use the existing proposal lifecycle.
- Trigger: successful projection preparation and automatic apply.
- Data: existing `agentRuns`, `agentProposals`, source bindings, applied updates, and inverse updates.
- Empty: nothing is shown before Add to graph.
- Loading: show checkpoint/apply progress; do not claim completion early.
- Error: show failed status and no graph mutation or partial residue.
- Populated: applied status, internal provider identity, exact evidence count, durable receipt, and Undo.
- Overflow: receipt fields wrap and operation count remains within the existing 30-operation client limit.
- Responsive: receipt rows stack or wrap without changing the notebook canvas.

## Explicitly out of scope

- Notebook navigation, breadcrumb, search, outline editing, hashtags, favorites, and phone handoff.
- Ask/Agent/Organization and Auto/Plan mode controls.
- Runtime-evaluation synapse map visuals.
- A new agent route, a second graph renderer, or a custom SVG graph implementation.
