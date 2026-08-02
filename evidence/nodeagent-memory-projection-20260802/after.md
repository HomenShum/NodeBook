# NodeAgent typed-memory production proof — 2026-08-02

## Named proof

A signed NodeBook user can inspect and control a recalled typed memory, project it into the real graph through the standard checkpoint lifecycle, recover the durable receipt after reload, and undo the complete projection without leaving the projected node behind.

## Observed production sequence

1. The production alias returned HTTP 200 with a raw `NodeBook` HTML signal, and the new Vercel deployment was `Ready`.
2. A signed read-only NodeAgent run completed with runtime verification `6/6`, a durable receipt, bounded notebook retrieval, semantic matching, graph traversal, exact node inspection, and recalled memories.
3. The first recalled memory expanded to show its original request, recording time, duration, and seven exact notebook sources.
4. Pin changed to Unpin and then returned to Pin after the live unpin action.
5. Add to graph prepared one readable memory node plus seven `relatedTo` operations. The receipt reported provider `nodebook`, model `deterministic-memory-projection-v1`, seven evidence nodes, and a durable checkpoint.
6. The checkpoint reached `applied`. A hard reload restored the applied receipt, provider, model, and Undo control.
7. Undo changed the durable checkpoint to `undone` and removed the projected memory node. A second hard reload restored the undone receipt and the projected node remained absent.
8. The application console contained zero errors at the end of the sequence.

## Evidence artifacts

- `empty.png` — signed production notebook before opening NodeAgent.
- `populated.png` — terminal read-only response with recalled-memory controls.
- `inspected.png` — expanded memory inspection state.
- `applied.png` — applied graph projection and durable receipt.
- `reloaded-applied.png` — applied receipt recovered after hard reload.
- `undone.png` — whole-run Undo completed and projected node absent.
- `reloaded-undone.png` — undone receipt recovered after hard reload; projected node still absent.

## Deliberate boundary

Forget was not executed against an actual production memory solely for demonstration. Owner-isolated inspect/pin/unpin/forget behavior and the 20-pin/200-memory bounds are covered by Convex production-shaped scenarios. No test assertion was weakened.
