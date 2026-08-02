# NodeAgent NotebookTools boundary proof

Date: 2026-08-02

## Named proof

Every NodeAgent UI graph mutation must pass through one typed NotebookTools port. A concurrent checkpoint loser must receive conflict data without marking the winning checkpoint failed; persistence outages and stale-source rollback conflicts must remain distinguishable.

## Implementation evidence

- `src/app/query/notebookTools.ts` owns checkpoint claim, GraphStore application, durable applied/failed transitions, rejection, and whole-run Undo.
- `src/app/query/page.tsx` no longer imports the graph apply/undo helpers or checkpoint lifecycle directly.
- `src/app/api/query/soleEngine.test.ts` scans non-test application sources and permits the guarded mutation calls only from `query/notebookTools.ts`.

## Scenario evidence

- Two concurrent signed-tab actors: one typed success, one `checkpoint_conflict`, one graph write, zero loser-driven failed transitions.
- Accepted checkpoint plus durable sync timeout: `persistence_failure`, `retryable: true`, and one durable failed transition.
- Whole-run Undo after a user edit: `source_conflict`, no durable Undo claim, no overwrite of the newer user state.

## Gates

- Targeted NotebookTools/checkpoint/rollback tests: 10 passed.
- Full Jest suite: 55 suites, 281 tests passed.
- Convex production-shaped suite: 49 tests passed, including sustained memory, evaluation, and provider-journal bounds.
- TypeScript: passed.
- Changed-file lint: no warnings or errors.
- Next.js production build: passed; pre-existing hook warnings remain outside this change.

