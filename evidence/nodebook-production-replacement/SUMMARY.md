# NodeBook production-replacement proof

## Scope

The original notebook application was migrated in place: product identity is NodeBook, the legacy persistence/realtime runtime is removed, and Convex + Auth0 are the production contract.

## Matched before/after evidence

| Gate | Before | After |
| --- | ---: | ---: |
| Legacy product-name mentions outside evidence/build/dependencies | 326 | 0 |
| Legacy database/realtime runtime matches outside evidence/build/dependencies | 107 | 0 |
| Legacy-name filenames | not separately captured | 0 |
| Core Jest scenarios | 8 passing in the initial targeted baseline | 160 passing across 25 suites |
| Convex production scenarios | not present | 6 passing |
| TypeScript | passing | passing |
| Production build | not matched in this slice | passing, 38 pages generated |

The final 1440x900 notebook screenshot differs from the prior in-place NodeBook UI proof by 22,587 pixels (1.74282%). Inspection confirms the established notebook layout is preserved. The final route, document title, and special IDs use NodeBook. A fresh load recorded zero console errors, page errors, or failed HTTP responses.

## Reliability proof

- Atomic authenticated writes with version conflicts and idempotency receipts.
- Independent deterministic owner/public realtime cursors, including same-millisecond concurrency.
- Bounded client queues, snapshot pages, response bodies, sync feeds, transaction receipts, notifications, and caches.
- HTTPS/localhost URL validation, request timeouts, and bounded request/response streams.
- Deterministic, digest-checked, idempotent migration batches with conflict rejection.
- Shared bounded snapshot recovery for initial load and two-tab divergence.

## Activation status

The repository replacement is code-complete and locally verified. External production activation was not performed because this workspace has no Convex deployment URL/key, migration secret/source export, Auth0 production values, or production hosting credentials. The exact rehearsal, activation, evidence, stop conditions, and rollback steps are in `doc/PRODUCTION_CUTOVER.md`.
