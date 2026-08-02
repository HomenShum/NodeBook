# NodeAgent production completion audit

Date: 2026-08-02

Verdict: **PASS - the production contract, legacy workflows, current-deployment responsive clips, and final post-parity NodeRoom comparison are complete.**

This audit treats prior reports as claims. A row passes only when the repository contains a concrete implementation, a scenario-level test or invariant, and production observation where the requirement is inherently live.

| Requirement | Evidence | Verdict |
| --- | --- | --- |
| Preserve the original Mew notebook UI while renaming the product to NodeBook | Signed production screenshots in `evidence/nodeagent-final-production-20260802`; raw alias HTML returned HTTP 200 with `NodeBook` and without active `Mew` or `Ideaflow` copy | PASS |
| Use legacy MewAgent and the locked Notion behavior as the baseline | `docs/NODEAGENT_LEGACY_PARITY_INVENTORY.md`; `evals/nodeagent-notion-parity.json` | PASS |
| One NodeAgent engine, including inline entrypoints | `src/app/api/query/soleEngine.test.ts` source-scans API entrypoints, durable workflow writers, and UI mutation callers | PASS |
| Checkpoint -> safe Auto execution -> durable receipt -> whole-run Undo; Plan remains optional | `src/app/query/notebookTools.ts`, `src/app/query/page.tsx`, checkpoint/rollback scenario tests, signed Auto and Plan production states | PASS |
| Typed conflict handling under races and stale state | `src/app/query/notebookTools.test.ts` proves a two-tab single winner, a retryable persistence outage, and stale-source Undo refusal | PASS |
| Search -> graph traversal -> specialized workflow | `src/app/api/query/workflowAgent.ts`; live eval scorer requires ordered `find_nodes`, `run_specialized_workflow`, `finish_investigation` steps | PASS |
| Typed bounded memory with visible graph projection | Memory route/schema plus production memory projection evidence catalogued in the parity inventory | PASS |
| Hybrid lexical/semantic/graph retrieval | `src/app/api/query/retrievalFusion.ts` and workflow scenario tests | PASS |
| Six locked Notion live eval cases | The signed production runtime verifier displayed 6/6; the real Mamba/SSM replay then exposed and closed a planner-timeout/target-selection gap. Trace `3e3485c5-0233-4d8b-ab96-ee103958a986` applied the exact edge and passed reload/Undo/reload. | PASS |
| Automatic free-model rebenchmark on catalog changes or repeated failures, fail closed on incompatibility | Convex production tests and model-routing code; the current four-model production benchmark certified none and retained the paid fallback | PASS |
| Agent graph UI uses a maintained renderer rather than custom SVG | `@xyflow/react` is pinned at 12.11.2; `RuntimeSynapseMap.tsx` renders React Flow nodes/edges; its test rejects hand-drawn graph SVG architecture | PASS |
| Anonymous entry for easy evaluation | Anonymous graph-store/auth path and responsive guest evidence | PASS |
| Convex durability and reliability substrate | Production-shaped Convex suite passed 49 scenarios; typed checkpoint port preserves exact source bindings and deterministic conflict outcomes | PASS |
| Cross-learn with NodeRoom after parity | After both current-deployment responsive journeys closed, NodeRoom was re-opened read-only at current commit `387a924c`. The final comparison confirms NodeRoom's sliced journal/runtime and NodeBook's exact graph checkpoint/whole-run Undo plus automatic catalog/failure certification as complementary, not replacement architectures. | PASS |
| Authenticated production proof of legacy multi-level research | Signed Web3 research completed five of six bounded searches, materialized seven structured operations with 16 sources, survived reload, and was absent after Undo plus clean reload. | PASS |
| Targeted research-and-fill of an existing profile section | Signed trace `55fcc436-25b1-4a85-9545-3def6ed08f98` created the missing `Leadership` section beneath the exact reviewed profile plus one evidence child. A separate fresh tab rendered the exact hierarchy; URL-bound receipt recovery, Undo after hydration churn, and a clean reload with no remaining section all passed. | PASS |
| Live existing-profile reuse plus missing-profile creation | Signed trace `40a32be8-694c-4c3f-b8cf-d95d6fba9a29` selected the exact complete/missing fixtures, stopped at the explicit clone approval boundary, applied one container + one clone + one missing profile after approval, retained both generated children after reload, then removed the complete generated container through Undo plus clean reload while preserving both originals. | PASS |
| Fresh continuous signed tablet and phone end-to-end clips on the current deployment | The phone 390x844 and tablet 768x1024 MP4s were captured after deployment `dpl_6KjTw7so3SXzbXyJ7Y8CvYewqaVe` became Ready. Both show signed Ask, safe Auto apply, durable receipt, Undo, and clean reload. Exact viewport/overflow and zero-console-error checks passed. | PASS |

## Graph renderer decision

React Flow remains the best fit for NodeBook's editable notebook mind map because its official API is centered on custom React nodes, handles, selection, dragging, connections, viewport control, and keyboard/screen-reader behavior. Cytoscape.js is the stronger alternative when graph analysis algorithms become the primary need. Sigma.js is the scale alternative for WebGL visualization of thousands of nodes. ELK is a layout engine only and can be added later for deterministic hierarchical placement without replacing React Flow.

Primary references:

- React Flow custom nodes: https://reactflow.dev/learn/customization/custom-nodes
- React Flow accessibility: https://reactflow.dev/learn/advanced-use/accessibility
- Cytoscape.js: https://js.cytoscape.org/
- Sigma.js: https://www.sigmajs.org/docs/
- Eclipse Layout Kernel: https://eclipse.dev/elk/

## Production observation

- Alias: `https://nodebook-rho.vercel.app`
- Deployment: `dpl_6KjTw7so3SXzbXyJ7Y8CvYewqaVe`
- Deployed code commit: `d3867ab5`
- Vercel status: Ready, target production
- Raw live DOM check: HTTP 200; `NodeBook=true`, `Mew=false`, `Ideaflow=false`
- Regression gates: Jest 55/55 suites and 293/293 tests; Convex 49/49; TypeScript, lint (known warnings only), local build with explicit production-shaped env, and cloud build passed

## Exact remaining production bar

No requirement from this production replacement scope remains open. Future NodeRoom-derived improvements—resumable sliced research, richer memory freshness/invalidation, and cost/frontier receipts—are product evolution items, not blockers for the completed replacement contract.
