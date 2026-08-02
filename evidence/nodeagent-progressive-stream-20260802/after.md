# NodeAgent progressive stream proof

Date: 2026-08-02

## Named proof

An authenticated production Ask run must display a bounded NodeAgent tool trace before its final durable receipt, while using the same sole engine as JSON and eval callers.

## Environment

- Production: `https://nodebook-rho.vercel.app`
- Deployment: `dpl_XnQX89NYse7qeDNvCLUVA17BfLMq`
- Code commit: `6e970a66` (`feat: stream NodeAgent steps from sole engine`)
- Persona: signed-in NodeBook owner
- Scenario: ask which notes suggest recurring conversations or resurfacing ideas

## Observed acceptance evidence

- During execution, `mid-run.png` shows `Running...`, a bounded rationale, and the `find_nodes`, `semantic_retrieval`, `find_related_nodes_via_graph`, `get_node_details`, and follow-up `find_nodes` tool trace.
- At that moment the final receipt was absent. This distinguishes progressive rendering from a completed-result replay.
- `completed.png` shows the same run after its final durable receipt.
- Semantic retrieval matched five notes and refreshed 24 owner-scoped embeddings.
- The UI requested `text/event-stream`; JSON clients and the locked eval harness retain their existing result contract.

## Regression evidence

- Full test run: 48 suites passed, 243 tests passed.
- Typecheck passed.
- Local production build passed after an earlier import-order failure was fixed and rerun.
- Vercel production build passed and the deployment reached Ready.
- The sole-engine gate permits only `/api/query` and `/api/query/evals` to call `executeWorkflowAgent` and rejects duplicate NodeAgent/MewAgent classes or provider-specific agent routes.

## Graph rendering boundary

The NodeAgent runtime synapse map uses pinned `@xyflow/react` 12.11.2. No custom SVG graph renderer was added. `elkjs` is reserved for future automatic hierarchical layout; Sigma.js is reserved for a future read-only large-graph mode if measured scale requires WebGL.

## Remaining proof

- Replay safe Auto mutation, checkpoint, `client_action`, receipt, and whole-run Undo under the new streaming transport.
- Capture refreshed desktop, tablet, and phone end-to-end clips.
