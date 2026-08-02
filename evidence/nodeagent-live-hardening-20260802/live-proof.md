# NodeAgent live planner and hydration hardening proof

Date: 2026-08-02

Final deployment: `dpl_BKm1CZRK7F4D2GH458rByUnnKC7a` (`READY`, production), aliased to `https://nodebook-rho.vercel.app`.

## Signed hydration

A fresh signed tab loaded the original NodeBook root notebook after all eight owned/public Convex snapshot streams completed.

- Title: `Homen Shum - NodeBook`
- Notebook shell: present
- NodeBook application warnings/errors: 0
- Document-level horizontal overflow: none
- Extension warnings were captured separately and were not attributed to NodeBook.
- Pixel evidence: `signed-hydration-zero-app-logs.png`

This is the knockout rerun for the prior `Relation with id ... does not exist` warning flood. The client now removes only relation-list position entries whose relation document is absent from the complete owner-visible snapshot.

## Semantic repeat guard

Initial signed trace `a048d23c-8310-4396-8712-1789d64ff2ff` showed that ignoring rationale alone was insufficient: the model also paraphrased the specialized tool's unused query. The durable provider journal exposed the exact boundary.

Final signed trace `c1e9c6b4-fef4-4cab-aaf7-1e7dfe5d9337` on the final deployment persisted:

1. `find_nodes` completed.
2. `semantic_retrieval` completed.
3. Exactly one `run_specialized_workflow` completed.
4. The second semantic duplicate stopped at a failed deterministic checkpoint.
5. Synthesis returned no unsafe operations; deterministic repair produced the exact one-node Plan proposal.
6. The proposal was rejected; no graph mutation occurred.

Provider journal count was four calls: two planner decisions, one synthesis, and one repair. Usage was 18,711 tokens versus 25,149 in the immediate pre-knockout run and 27,459 in the original four-workflow trace. The reduction is 25.6% versus the immediate run and 31.8% versus the original.

The live model route recorded two consecutive model-quality failures from the two signed hardening runs. The configured third-failure transition remains responsible for scheduling one bounded benchmark rerun.

Pixel evidence: `semantic-repeat-guard-trace.png`.

## Deployment and raw DOM

- `vercel ls nodebook`: newest deployment Ready in Production.
- Public alias: HTTP 200.
- Raw HTML signal: `NodeBook` present; `Mew` and `Ideaflow` absent.
