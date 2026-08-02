# NodeAgent semantic retrieval — after proof

- Route: signed production NodeBook workspace on `https://nodebook-rho.vercel.app`
- Desktop viewport: 2048 × 1100, light theme
- Mobile viewport: 390 × 844, light theme
- Persona: signed notebook owner asking a read-only recurrence question
- Exact query: `Which notes suggest recurring conversations or ideas that keep resurfacing?`
- Production deployment: `dpl_44aCnWZfXA268VtSjaZGCkYHkbpr`
- Commit: `3f7a37bc`

## Observed populated state

- Status: completed; no `Not completed` or degraded-semantic disclosure
- Semantic receipt: `Matched 4 semantic note(s) and refreshed 24 embedding(s).`
- Workflow: owner-scoped search, semantic retrieval, graph traversal, exact-node inspection, synthesis, deterministic validation, finish
- Evidence: seven exact notebook citations with source versions
- Persistence: durable run receipt
- Runtime certification: 6/6 passed
- Production data: 24 nodes have a 1,536-dimensional embedding whose embedding version equals the node version

## Responsive and console checks

- 390 × 844: `innerWidth = documentElement.scrollWidth = body.scrollWidth = 390`
- NodeAgent drawer bounds: x=0, width=390, fixed inset=0
- Stable mobile recapture shows query, mode controls, consent, runtime status, and populated answer
- No NodeBook-origin application errors or warnings were observed. Captured warnings came from a browser wallet extension content script.

## Artifacts

- `before.png`: real signed legacy NodeBook workspace before this retrieval change
- `after-loading.png`: live request-in-progress state
- `after-populated.png`: desktop populated state
- `after-mobile-390x844-v2.png`: stable mobile populated state
- `change-boundary.png` / `change-boundary.md`: labeled UI scope contract

## Failure closure

1. Initial production run failed because final synthesis retained a 24-second toy-case timeout after retrieval was added.
2. The next run completed but disclosed semantic degradation because embedding writes crossed the exact Convex mutation schema with an extra `contentText` field.
3. The write boundary now emits only `sourceId`, `version`, and `embedding`, chunks writes four at a time, and has regression coverage for exact keys and payload size.
4. The exact previously failing signed query passed after the final deployment.
