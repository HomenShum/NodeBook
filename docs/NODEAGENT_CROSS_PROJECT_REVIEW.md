# NodeAgent cross-project architecture review

Date: 2026-08-01

This review compares the active NodeBook in-place MewAgent port with NodeRoom's canonical NodeAgent harness. It treats working behavior and executable contracts as authoritative, not shared naming.

NodeRoom source was rechecked at commit `387a924c`. Its worktree contained unrelated user-owned proof/evidence changes; this review is read-only and did not modify them. Source inspection proves architecture, not deployed NodeRoom behavior.

## Decision

NodeBook should keep its graph-native operation, retrieval, checkpoint, receipt, and undo layer. It should adopt NodeRoom's trace/journal/runtime boundaries incrementally. NodeRoom should adopt NodeBook's exact graph source bindings, reversible whole-run checkpoints, visible typed memory projections, and continuously benchmarked free-model route.

Do not replace NodeBook's integrated engine with NodeRoom's spreadsheet-oriented runtime. Extract the contracts that improve durability without recreating a parallel agent path.

## Evidence compared

### NodeBook

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
| Mutation | Typed graph operations, deterministic checkpoint digest, inverse updates, whole-run undo | `RoomTools` port returns conflicts as model-readable data | Define a `NotebookTools` port over the existing GraphStore/Convex operations; never bypass it |
| Reliability | Bounded context, tools, operations, response bodies, memories, and model candidates | Deadlines, reserve budget, compaction, spend ceiling, exactly-once journal | Adopt deadline/spend/journal before increasing tool-loop depth |
| Traceability | Durable run/step/checkpoint receipts and exact citations | One `traceId` links every durable artifact and eval | Treat NodeBook `runId` as canonical `traceId` and propagate it explicitly to memory/eval projections |
| Memory | Typed, owner-scoped, bounded records with pin/forget and visible graph projection | Evidence/failure memory with invalidation and context assembly | Add freshness/invalidation metadata; keep user-visible controls |
| Evaluation | Notion parity corpus plus automatic free-model promotion | Locked certification vs exploratory scenario generation | Split NodeBook evals into immutable parity certification and editable discovery cases |
| Model routing | Hourly catalog-change detection, strict 6/6 Notion promotion, failure rerun, fail-closed paid fallback | Cost ledger, frontier observations, official-vs-shadow distinction | Add cost/frontier receipts to NodeBook; reuse NodeBook's small router in NodeRoom |
| Notebook editing | Graph-native node/relation operations and whole-run inverse receipt | Read-first block port, stable block IDs, CAS hashes, protected human prose, merge dedupe, conflicts as data | NodeBook should copy the conflict/result contract; NodeRoom should copy graph scope and whole-run undo |
| Recovery | Single-winner checkpoint and whole-run undo | Durable job slices, leases, cursor handoff, per-element version restore | NodeBook adopts resumable slices before longer loops; NodeRoom adds run-level inverse grouping |

## NodeBook adoption order

1. **Sole-engine gate:** keep `executeWorkflowAgent` as the only NodeAgent entrypoint; fail CI if an unreferenced second engine appears.
2. **Trace spine:** make `runId` the documented `traceId` across run, step, checkpoint, memory, model evaluation, UI citation, and exported evidence.
3. **Exactly-once journal:** persist model/tool step keys before supporting resumable or longer runs. A retry must replay a completed receipt instead of rebilling or duplicating writes.
4. **NotebookTools boundary:** isolate reads, source validation, checkpoint claim, graph writes, receipts, and undo behind one typed port that returns conflicts as data.
5. **Deadline and spend budget:** reserve persistence time before the platform timeout; stop with an honest resumable receipt instead of losing the run.
6. **Certification split:** lock the Notion-authored MewAgent cases and verifier; let newly discovered adversarial cases live in a separate exploration corpus.
7. **Live proof command:** one command must exercise authenticated context retrieval, a read-only answer, Plan preview, safe Auto execution, high-risk pause, receipt persistence, and undo against deployed Convex.

## What NodeRoom should adopt

1. Exact source bindings `{sourceId, version, digest}` on every mutation-capable frame.
2. Checkpoint → auto-execute → durable receipt → whole-run inverse updates for reversible low-risk work.
3. Owner-scoped typed memory with hard retention bounds, pin/forget controls, and optional visible graph projection.
4. Retrieval that combines lexical score, graph neighborhood, current-root weighting, recency, and explicit citation targets.
5. A small automatic free-model route that refreshes on catalog change or repeated failures and promotes only a perfect compatibility score.

## Live comparison findings

- The 2026-08-01 `nodeagent-notion-parity-v2` production run evaluated four current free structured/tool-capable OpenRouter models. None completed any of the six workflows, so NodeBook correctly certified no free route and fell back to its configured OpenAI model.
- The best available free candidate satisfied 5 of 23 individual criteria (21.7%) but 0 of 6 complete workflows. Partial criteria rank diagnostics only; they never relax the perfect promotion gate.
- NodeRoom's bounded iterative runtime, exactly-once journal, deadline reserve, spend ceiling, and trace spine remain the strongest adoption targets for NodeBook.
- NodeBook's exact graph source bindings, typed graph operations, single-winner checkpoint, whole-run inverse receipt, owner-scoped bounded memory, and automatic release/failure certification remain the strongest adoption targets for NodeRoom.
- NodeRoom has extensive model matrices and a manually invoked free-model gauge, but no model-catalog benchmark cron was found in `convex/crons.ts`; NodeBook's automatic catalog-change trigger is therefore additive rather than duplicative.
- NodeRoom proves per-element restore as a new CAS write. No equivalent verified whole-agent-run inverse transaction was found; NodeBook's `Undo this run` is the stronger recovery primitive for multi-operation graph work.

## Non-adoptions

- Do not import NodeRoom's domain-specific BankerToolBench behavior into NodeBook.
- Do not add a second generic runtime beside the integrated notebook engine.
- Do not turn trace data into hidden prompt transcript memory.
- Do not let exploratory cases grade or promote themselves.
- Do not require approval for reversible owner-scoped notebook writes.

## Completion evidence required

The comparison is implemented only when the sole-engine search is clean, the parity suite is executable, production fails closed when no model passes (or uses a fully certified promoted model), a real notebook run leaves a durable trace/checkpoint/receipt, Undo restores the source state, and the locked certification output records the exact deployed versions.
