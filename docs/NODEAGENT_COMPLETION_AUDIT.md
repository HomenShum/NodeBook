# NodeAgent production completion audit

Date: 2026-08-02

Verdict: **WARNING - production code is deployed and the principal parity contract is proven, but two requested end-to-end proofs remain open.**

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
| Six locked Notion live eval cases | The signed production runtime verifier displayed 6/6; the immutable corpus remains separate from exploratory cases | PASS |
| Automatic free-model rebenchmark on catalog changes or repeated failures, fail closed on incompatibility | Convex production tests and model-routing code; the current four-model production benchmark certified none and retained the paid fallback | PASS |
| Agent graph UI uses a maintained renderer rather than custom SVG | `@xyflow/react` is pinned at 12.11.2; `RuntimeSynapseMap.tsx` renders React Flow nodes/edges; its test rejects hand-drawn graph SVG architecture | PASS |
| Anonymous entry for easy evaluation | Anonymous graph-store/auth path and responsive guest evidence | PASS |
| Convex durability and reliability substrate | Production-shaped Convex suite passed 49 scenarios; typed checkpoint port preserves exact source bindings and deterministic conflict outcomes | PASS |
| Cross-learn with NodeRoom after parity | `docs/NODEAGENT_CROSS_PROJECT_REVIEW.md`, checked against NodeRoom commit `387a924c`; adopted conflicts-as-data and documented freshness/invalidation follow-up | PASS |
| Authenticated production proof of legacy multi-level research | Implementation and bounded tests exist, but `docs/NODEAGENT_LEGACY_PARITY_INVENTORY.md` still records the authenticated multi-level production run as pending | **OPEN** |
| Fresh continuous signed tablet and phone end-to-end clips on the current deployment | Current signed desktop states and earlier certified responsive frames exist. The MP4s are honest frame sequences; they are not continuous current-deployment interaction recordings | **OPEN** |

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
- Deployment: `dpl_5pTRmwGidmHspgDGxW5ku6QWCBUW`
- Deployed code commit: `cd533b73`
- Vercel status: Ready, target production
- Raw live DOM check: HTTP 200; `NodeBook=true`, `Mew=false`, `Ideaflow=false`
- Regression gates: Jest 55/55 suites and 281/281 tests; Convex 49/49; TypeScript, changed-file lint, local build, and cloud build passed

## Exact remaining production bar

1. Run the legacy multi-level research scenario in the signed production notebook, verify its bounded evidence fan-out, structured synthesis, nested graph result, durable receipt, reload, whole-run Undo, and clean reload.
2. Record one continuous signed interaction at tablet width and one at phone width against the current production deployment, including open NodeAgent, Ask, Auto execution, receipt, Undo, reload, and console/error evidence.

Until both steps are observed, this project should be described as deployed with two open proof requirements, not fully production-complete.
