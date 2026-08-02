# NodeAgent cross-project architecture review

Date: 2026-08-02

This review compares the active NodeBook in-place MewAgent port with NodeRoom's canonical NodeAgent harness. It treats working behavior and executable contracts as authoritative, not shared naming.

NodeRoom source was rechecked at commit `387a924c`. Its worktree contained unrelated user-owned proof/evidence changes; this review is read-only and did not modify them. Source inspection proves architecture, not deployed NodeRoom behavior.

## Decision

NodeBook should keep its graph-native operation, retrieval, checkpoint, receipt, and undo layer. It should adopt NodeRoom's trace/journal/runtime boundaries incrementally. NodeRoom should adopt NodeBook's exact graph source bindings, reversible whole-run checkpoints, visible typed memory projections, and continuously benchmarked free-model route.

Do not replace NodeBook's integrated engine with NodeRoom's spreadsheet-oriented runtime. Extract the contracts that improve durability without recreating a parallel agent path.

## Evidence compared

### NodeBook

- `src/app/api/query/workflowAgent.ts` now makes the legacy research composite explicit: 4-6 targeted parallel searches, bounded evidence receipts, one structured synthesis, and a nested graph work product. This keeps provider fan-out inside the sole engine.

- `src/app/api/query/workflowAgent.ts`: bounded search → graph traversal → specialized workflow loop, typed graph operations, deterministic digests, risk classification, and model repair.
- `src/app/api/query/route.ts`: owner-authenticated Convex context/memory lookup, bounded provider response, durable run recording, and promoted-model routing.
- `convex/agentWorkflows.ts`: owner-scoped runs, steps, checkpoints, typed bounded memory, hybrid retrieval, and durable state transitions.
- `src/app/query/checkpointExecution.ts`: single-winner checkpoint claim, local graph execution, honest failure receipt, and whole-run undo integration.
- `convex/modelRouting.ts`: hourly catalog fingerprinting, six-case Notion certification, bounded candidate evaluation, strict promotion, and failure-triggered reruns.

### NodeRoom

- `src/nodeagent/core/runtime.ts`: provider/tool/backend separation, bounded steps, wall-clock reserve, resumable messages/tool calls, exactly-once step journal, spend ceiling, compaction, hooks, and stream events.
- `src/nodeagent/core/frameRunner.ts`: reasoning frame wrapper and context envelope.
- `src/nodeagent/core/frameVerifier.ts`: deterministic frame/evidence receipt.
- `src/nodeagent/traces/*`: trace as the foreign-key spine across context, tools, mutations, evidence, approval, final output, and eval proof.
- `src/nodeagent/skills/notebook/notebookTools.ts`: block-level read-first notebook port, stable block IDs, CAS hashes, human-prose protection, merge dedupe, and conflicts returned as model-readable data.
- `convex/agent.ts` and `convex/agentJobRunner.ts`: action deadline reserve, token/dollar ceilings, bounded context, checkpoint cursors, leases, and resumable job slices.
- `AGENTS.md` and `docs/NODEAGENT_ADOPTION.md`: locked certification loop separated from open-ended exploration and a one-command adoption smoke.

## Bidirectional learnings

| Concern | NodeBook strength | NodeRoom strength | Decision |
|---|---|---|---|
| Product integration | Original notebook UI, inline `/nodeagent`, graph mutations | General room/frame adapters | Keep NodeBook in place; no second shell or engine |
| Retrieval | Owner-scoped lexical + graph-neighbor expansion + exact node/version digests | Context packs and JIT world-model assembly | Wrap NodeBook retrieval results in a versioned context-pack receipt |
| Mutation | Typed graph operations, deterministic checkpoint digest, inverse updates, whole-run undo | `RoomTools` port returns conflicts as model-readable data | **Implemented 2026-08-02:** `createNotebookTools` is the sole UI mutation port for checkpoint execution, rejection, and undo; two-tab, persistence, and stale-source conflicts return typed data rather than transport-shaped exceptions. |
| Reliability | Bounded context, tools, operations, response bodies, memories, and model candidates | Deadlines, reserve budget, compaction, spend ceiling, exactly-once journal | Adopt deadline/spend/journal before increasing tool-loop depth |
| Traceability | Durable run/step/checkpoint receipts and exact citations | One `traceId` links every durable artifact and eval | **Implemented 2026-08-02:** NodeBook `runId` is the canonical `traceId` across new run, step, checkpoint, memory, runtime-eval, API, and UI receipts; historical rows use a non-destructive fallback. |
| Memory | Typed, owner-scoped, bounded records with pin/forget and visible graph projection | Evidence/failure memory with explicit freshness levels and invalidation reasons | Next adoption: add source-freshness/invalidation metadata to NodeBook memories without weakening pin/forget or visible graph projections. |
| Evaluation | Notion parity corpus plus automatic free-model promotion | Locked certification vs exploratory scenario generation | Split NodeBook evals into immutable parity certification and editable discovery cases |
| Model routing | Hourly catalog-change detection, strict 6/6 Notion promotion, failure rerun, fail-closed paid fallback | Cost ledger, frontier observations, official-vs-shadow distinction | Add cost/frontier receipts to NodeBook; reuse NodeBook's small router in NodeRoom |
| Notebook editing | Graph-native node/relation operations and whole-run inverse receipt | Read-first block port, stable block IDs, CAS hashes, protected human prose, merge dedupe, conflicts as data | NodeBook should copy the conflict/result contract; NodeRoom should copy graph scope and whole-run undo |
| Recovery | Single-winner checkpoint and whole-run undo | Durable job slices, leases, cursor handoff, per-element version restore | NodeBook adopts resumable slices before longer loops; NodeRoom adds run-level inverse grouping |
| Composite research | Deterministic query plan, bounded parallel evidence receipts, one typed nested graph synthesis | Durable sliced jobs and exactly-once provider-step replay | Keep NodeBook's research shape; add NodeRoom's journal before allowing research to resume across slices |

## NodeBook adoption order

1. **Sole-engine gate (implemented):** `executeWorkflowAgent` is the only NodeAgent entrypoint; a source-scanning CI test fails if a second engine class/provider route appears or an unauthorized caller is added. Only the production route and locked eval harness may call it.
2. **Trace spine (implemented):** `runId` is the canonical `traceId` across run, step, checkpoint, memory, runtime evaluation, API/UI citation, and exported evidence. Convex rejects a mismatched pair; historical rows remain readable through `traceId ?? runId`.
3. **Leased completed-step replay journal (implemented; provider-response crash window remains):** the client reuses one request/trace identity for unchanged retries, provider inputs receive deterministic step keys, and a durable pre-call lease stops simultaneous retries before a second provider call. Completed outputs are owner-scoped and replayed without rebilling, failed calls release their lease for immediate retry, failed runs recover in place, and history is bounded to 100 steps per trace / 500 per owner. A process crash after the provider responds but before the Convex completion write can still rebill after lease expiry; provider-native idempotency or a durable workflow primitive is required for strict exactly-once closure across that boundary.
4. **NotebookTools boundary (implemented):** `src/app/query/notebookTools.ts` isolates checkpoint claim, GraphStore writes, durable receipt transitions, rejection, and whole-run undo behind a typed result port. A checkpoint race returns `checkpoint_conflict` without marking the winning tab failed; stale source/rollback state and retryable persistence outages remain distinct data.
5. **Deadline and spend budget (implemented):** every planner, research, synthesis, and repair call contributes to one honest usage ledger. The production route caps observed usage at 100,000 tokens, fails closed when telemetry is missing, and stops new provider calls after a 110-second provider deadline so ten seconds remain for durable receipts and failure handling.
6. **Certification split:** lock the Notion-authored MewAgent cases and verifier; let newly discovered adversarial cases live in a separate exploration corpus.
7. **Live proof command:** one command must exercise authenticated context retrieval, a read-only answer, Plan preview, safe Auto execution, high-risk pause, receipt persistence, and undo against deployed Convex.

## What NodeRoom should adopt

1. Exact source bindings `{sourceId, version, digest}` on every mutation-capable frame.
2. Checkpoint → auto-execute → durable receipt → whole-run inverse updates for reversible low-risk work.
3. Owner-scoped typed memory with hard retention bounds, pin/forget controls, and optional visible graph projection.
4. Retrieval that combines lexical score, graph neighborhood, current-root weighting, recency, and explicit citation targets.
5. A small automatic free-model route that refreshes on catalog change or repeated failures and promotes only a perfect compatibility score.

## Live comparison findings

- **Final post-parity recheck:** the current NodeRoom checkout was reopened read-only at commit `387a924c` only after the signed 390x844 and 768x1024 NodeBook journeys passed against deployment `dpl_6KjTw7so3SXzbXyJ7Y8CvYewqaVe`. NodeRoom's checkout contained unrelated user-owned proof/evidence changes, which were not modified. The commit is unchanged from the earlier architecture read, so the conclusions below remain current rather than inferred from a stale branch.
- The post-parity recheck found a manually invoked free-model gauge and extensive benchmark scripts in NodeRoom, but still no catalog-change or failure-threshold benchmark scheduler in `convex/crons.ts`. NodeBook's hourly catalog fingerprint plus repeated-failure rerun remains the automatic production route the user requested.
- The same recheck confirmed NodeRoom's stronger bounded sliced runtime, journal, lease, reserve, and cost-control seams. These remain the next additive improvements for long NodeBook research; they do not justify replacing NodeBook's original UI, graph-native operations, exact source bindings, or whole-run Undo.

- The 2026-08-02 source recheck used NodeRoom commit `387a924c`: `agentJobRunner` executes bounded leased slices, derives a stable journal key before the provider call, and checkpoints a cursor for continuation. NodeBook's new deep-research composite remains single-request and must adopt that journal/checkpoint boundary before its parallel searches are made resumable.

- The 2026-08-02 10:34 UTC `nodeagent-notion-parity-v4` production run evaluated four current free structured/tool-capable OpenRouter models: `google/gemma-4-26b-a4b-it:free`, `nvidia/nemotron-nano-9b-v2:free`, `nvidia/nemotron-3-super-120b-a12b:free`, and `openai/gpt-oss-20b:free`. None completed any of the six workflows, so `benchmarkStatus` is `failed`, the certified route returns no free model, and NodeBook correctly falls back to its configured OpenAI model.
- The best available free candidate, Gemma 4 26B, satisfied 14 of 24 individual criteria (58.3%) but 0 of 6 complete workflows. Partial criteria rank diagnostics only; they never relax the perfect promotion gate.
- NodeRoom's bounded iterative runtime, exactly-once journal, deadline reserve, spend ceiling, and trace spine remain the strongest adoption targets for NodeBook.
- NodeBook's exact graph source bindings, typed graph operations, single-winner checkpoint, whole-run inverse receipt, owner-scoped bounded memory, and automatic release/failure certification remain the strongest adoption targets for NodeRoom.
- NodeRoom has extensive model matrices and a manually invoked free-model gauge, but no model-catalog benchmark cron was found in `convex/crons.ts`; NodeBook's automatic catalog-change trigger is therefore additive rather than duplicative.
- NodeRoom proves per-element restore as a new CAS write. No equivalent verified whole-agent-run inverse transaction was found; NodeBook's `Undo this run` is the stronger recovery primitive for multi-operation graph work.
- NodeRoom's notebook port returns `noSuchBlock`, `blockConflict`, `humanBlockProtected`, and `pendingApproval` as recoverable data. NodeBook now mirrors the architectural contract at graph-checkpoint granularity (`checkpoint_conflict`, `source_conflict`, `persistence_failure`, `execution_failure`) while retaining exact node/version digests instead of importing NodeRoom's block model.
- NodeRoom's NodeMem freshness and invalidation modules distinguish fresh, stale, expired, superseded, and rejected facts and record reasons such as source deletion, privacy change, or benchmark failure. NodeBook should add that metadata to typed memories next; it should not replace the existing owner bounds or user-visible pin/forget/projection controls.

## Non-adoptions

- Do not import NodeRoom's domain-specific BankerToolBench behavior into NodeBook.
- Do not add a second generic runtime beside the integrated notebook engine.
- Do not turn trace data into hidden prompt transcript memory.
- Do not let exploratory cases grade or promote themselves.
- Do not require approval for reversible owner-scoped notebook writes.

## Completion evidence required

The comparison is implemented only when the sole-engine search is clean, the parity suite is executable, production fails closed when no model passes (or uses a fully certified promoted model), a real notebook run leaves a durable trace/checkpoint/receipt, Undo restores the source state, the NotebookTools port proves conflict behavior, and the locked certification output records the exact deployed versions.
