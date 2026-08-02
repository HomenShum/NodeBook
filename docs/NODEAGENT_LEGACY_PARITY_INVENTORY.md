# NodeAgent legacy parity inventory

Date: 2026-08-01

This is the durable migration ledger for the in-place MewAgent-to-NodeAgent port. It inventories both recoverable legacy generations and records whether each behavior is ported, intentionally replaced, or still requires live proof. Historical names appear here only as provenance; shipped product copy and commands use NodeBook and NodeAgent.

## 2026-08-02 evidence correction

The earlier ledger used **Replaced** too broadly. A generic instruction or adjacent capability is not behavioral parity. Direct source inspection of both agent generations, Git commit `fdf6a105`, the inline client, current runtime receipts, and the six locked cases produced these binding corrections:

| Prior claim | Correct current state |
|---|---|
| Specialized research/organization/profile behavior was ported through instructions | Until 2026-08-02, `run_specialized_workflow` returned only candidate IDs and the final model had to invent all operation structure. Research now generates 4–6 bounded targeted queries, runs them in parallel, records honest evidence receipts, and synthesizes 3–12 typed hierarchical work products; scenario tests pass and renewed production receipts remain required. |
| `create_knowledge_map` was replaced by the connect workflow | **Corrected and proven 2026-08-02.** The sole engine now performs owner-scoped embedding retrieval, deterministic bounded clustering, and reversible hierarchy materialization. Production Auto apply, reload, Undo, and reload were observed; React Flow remains evidence UI rather than the workflow implementation. |
| Company/person deep dives and report outline/population were replaced by generic research | **Corrected and production-proven 2026-08-02.** Research-profile commands dispatch to bounded web research before the generic profile-clone path. Complete entity receipts deterministically materialize every requested section; incomplete evidence keeps the stricter model-validation/fail-closed path. |
| Durable steps fully ported streaming events | **Ported.** The sole `/api/query` engine now emits bounded `thought`, `tool_call`, `tool_result`, `client_action`, `final_summary`, `error`, and `end` SSE events while preserving the durable step/receipt record. Authenticated production proof captured the tool trace before the final receipt on 2026-08-02. |
| Typed memory fully replaced legacy memory UX | **Ported; destructive live proof intentionally limited.** Owner-scoped typed records expose inspect provenance, pin/unpin, forget, and a cited graph projection. Production proved inspect, pin/unpin, deterministic checkpointed projection, durable reload recovery, whole-run Undo, and clean reload on 2026-08-02. Forget is scenario-proven with owner isolation but was not run against a real learned production memory. |
| Rename followed parity | **Contradicted.** Product code already says NodeAgent while behavioral parity is incomplete; this historical sequencing error cannot be retroactively made true. |

For completion claims, **proven** now means executable scenario coverage plus the appropriate live production observation. Instructions, schemas, or a neighboring capability alone are insufficient.

## Authoritative sources

- Google generation: `D:\VSCode Projects\Ideaflow\prod-push-mew\mew` at Git `0de15d79`, including uncommitted forensic work in `src/app/api/llm/google-genai/agent/`.
- OpenAI generation: `D:\VSCode Projects\Ideaflow\latest-main-mew\mew` at Git `2013d86d`, especially `src/app/api/llm/openai/agent/` and `src/app/editor/plugins/dropdown/MentionDropdown.tsx`.
- Current integrated engine: `src/app/api/query/workflowAgent.ts`, `convex/agentWorkflows.ts`, `src/app/query/`, and `src/app/components/AiSearchSidebar/`.
- Behavioral acceptance source: `evals/nodeagent-notion-parity.json`.

The Google checkout is not a clean Git baseline. Its working tree is evidence to preserve, not code to restore wholesale.

## Tool inventory

Disposition meanings:

- **Ported**: a typed current implementation covers the behavior.
- **Replaced**: the capability is covered through a safer/generalized current boundary; copying the old implementation would regress reliability.
- **Deferred**: not required by the locked six-case parity corpus and not silently advertised by the current UI.
- **Proof pending**: implemented, but authenticated production behavior is not yet evidenced.

| Legacy tool or client action | Generation | Current disposition | Current implementation or reason |
|---|---|---|---|
| `display_debug_information` | Google | Replaced | Durable `AgentStep` digests and receipt UI replace graph-writing debug text. |
| `execute_multi_step_research_plan` | Both | Replaced / production-proven 2026-08-02 | The sole engine performs bounded query planning, parallel evidence gathering, structured synthesis, semantic depth validation, and one repair. A signed Web3 run completed five of six searches, applied seven structured operations with 16 sources, survived reload, and was absent after Undo plus clean reload. |
| `generate_report_outline` | Both | Replaced | Structured plan and typed `create_node` sequence; no separate outline tool is exposed. |
| `populate_report_from_outline` | Both | Replaced / production-proven 2026-08-02 | Container-first graph operations materialized the Web3 and person/company multi-section work products in signed production runs. |
| `execute_direct_request` | Both | Ported | Ask/Agent modes synthesize from bounded notebook context; Ask is read-only. |
| `evaluate_and_enhance_report` | Both | Replaced | Deterministic semantic validation plus one bounded repair. The old free-form self-score is not trusted. |
| `find_nodes` | Google internal SOP | Ported | Owner-scoped full-text + lexical retrieval and current-root weighting in `contextSnapshot`; iterative planner can choose it. |
| `find_related_nodes_via_graph` | Both | Ported | Bounded relation expansion marks and returns `graph_neighbor` context. |
| `get_node_details` | Broken/missing Google dependency | Ported | Typed bounded lookup over reviewed context; unknown IDs fail closed. |
| `get_note_index` | Google | Ported | Organization mode loads a bounded owner-scoped index and emits a durable step. |
| `get_all_notes_raw` | Google | Replaced | Owner-scoped bounded Convex snapshot; the model never receives an unbounded raw dump. |
| `get_notes_with_content` | Google internal | Replaced | Hydrated, chunk-aware Convex documents with response/context byte caps. |
| `research_company_deep_dive` | Both | Replaced / production-proven 2026-08-02 | A signed Auto run completed six of six searches, deterministically materialized the five exact requested aspects from their evidence receipts, applied six operations, persisted the receipt, and left no company profile after Undo plus reload. |
| `research_person_deep_dive` | Both | Replaced / production-proven 2026-08-02 | A signed Auto run completed five of six searches, synthesized all five requested profile aspects, applied a seven-operation hierarchy, persisted its receipt, and left no created profile after Undo plus reload. |
| `research_and_update_profile_section` | Both | Ported / production-proven 2026-08-02 | Signed trace `55fcc436-25b1-4a85-9545-3def6ed08f98` selected the exact reviewed profile despite competing same-title nodes, created the missing section plus one bounded evidence child, survived a fresh child-page load, rehydrated its receipt, and removed the complete subtree through Undo plus clean reload. |
| `get_company_profile` | Google | Replaced | Existing-note retrieval and exact-node inspection supersede a domain-specific getter. |
| `get_person_profile` | Google | Replaced | Existing-note retrieval and exact-node inspection supersede a domain-specific getter. |
| `research_and_create_notes` | Google | Replaced / production-proven 2026-08-02 | Signed research workflows emitted typed container/child operations, persisted them across reload, and removed them through whole-run Undo. |
| `create_knowledge_map` | Both | Ported and live-proven | Owner-scoped `text-embedding-3-small` vectors feed deterministic 2–5 cluster construction over at most 12 notes. The sole workflow emits one bounded typed create/move contract; production proved 12 evidence nodes, 2 clusters, 15 operations, durable Auto apply, reload, Undo, and clean reload. |
| `analyze_and_reorganize_notes` | Google internal | Replaced / production-proven 2026-08-02 | The signed meeting-note run selected the three exact prefixed notes, emitted one folder plus three moves, and preserved the unrelated control note. |
| `find_and_intelligently_clone_nodes` | Google | Replaced / production-proven 2026-08-02 | Signed trace `40a32be8-694c-4c3f-b8cf-d95d6fba9a29` selected one reviewed complete profile plus one missing profile, paused at the explicit hierarchy-clone approval boundary, materialized exactly one clone and one missing profile, survived reload, and removed the generated container through Undo plus clean reload while preserving both originals. |
| `batch_clone_nodes` | Google internal | Replaced | One bounded typed operation list and whole-run checkpoint replace an unbounded batch helper. |
| `clone_node_hierarchy` | Google client/internal | Ported, approval-gated | Typed operation exists; expansion risk requires approval. |
| `web_search` | Both | Ported | Explicit web-research mode uses provider retrieval and records source URLs; notebook-first remains mandatory. |
| `search_academic` | OpenAI | Deferred | No dedicated UI promise; generic web research may cover sources without claiming a specialist index. |
| `search_news` | OpenAI | Deferred | No dedicated UI promise; generic web research may cover sources without claiming a specialist index. |
| `create_node` | Both | Ported | Typed operation, scope validation, checkpoint, auto-apply when low risk, inverse receipt. |
| `create_node_and_get_details` | Both | Replaced | `create_node` temporary IDs and ordered operations provide deterministic references. |
| `update_node_content` | Both | Ported | Typed operation with reviewed ID/source-version validation and inverse update. |
| `delete_node` | Both | Ported, approval-gated | Typed operation; deletion never auto-applies. |
| `move_node` | Both | Ported | Typed operation; same-notebook reversible moves auto-apply after checkpoint. |
| `add_relation` | Both | Ported | Typed relation kinds; authorship changes require approval. |
| `create_hierarchy_and_move_nodes` | Legacy client composite | Replaced / production-proven 2026-08-02 | Ordered `create_node` + `move_node` operations executed as one checkpointed meeting-note transaction and were structurally restored by Undo. |
| `update_profile_section` | Legacy client composite | Replaced | Typed update operations and source bindings. |
| `create_hierarchy_from_outline` | Legacy client composite | Replaced | Ordered temporary-ID graph operations. |
| `create_profile_from_json` | Legacy client composite | Replaced | Typed bounded graph operations; arbitrary JSON-to-graph mutation is intentionally not restored. |
| `superconnector_prepare_outreach` | OpenAI | Deferred | External side effect is outside the notebook parity wedge and would require an integration/approval boundary. |
| `superconnector_schedule_event` | OpenAI | Deferred | External scheduling is outside the notebook parity wedge and would require an integration/approval boundary. |
| `finish_work` | Both | Ported | Terminal durable `finish_work` step and receipt. |

## Workflow inventory

| Legacy workflow | Required preserved behavior | Current state |
|---|---|---|
| Search broadly → inspect clues → traverse graph → specialize → finish | Iterative, bounded, notebook-first sensemaking | Live production trace proved `find_nodes → semantic_retrieval → find_related_nodes_via_graph → create_knowledge_map → finish_investigation → synthesize_from_notebook → validate_proposal → finish_work`. Specialized evidence is signal-preserving and prioritized within the same 40-node/byte bounds. |
| SOP A: hybrid synthesis | Combine multiple existing notes without duplication | Live in production: lexical/current-root anchors, vector similarity, graph expansion, recency/scope fusion, exact citations, and a durable semantic-retrieval receipt. Signed Notion-derived case matched 4 semantic notes and refreshed 24 owner-scoped embeddings on 2026-08-02. |
| SOP B: deep knowledge organization | Create one container before children and preserve hierarchy | Typed specialized operation contract implemented; live Notion proof pending. |
| SOP C: multi-entity research | Reuse existing entity profiles and research only gaps | Production-proven with one exact reviewed complete profile, one missing profile, approval-gated hierarchy cloning, reload persistence, and whole-run Undo that preserved both original fixtures. |
| Organization | Find exact bounded matches, create folder, move only matches | Production-proven with the signed three-meeting case: three exact citations, one folder, three moves, unrelated control preserved, and durable Undo. |
| Connection | Reuse both nodes, create explanation child, add relation | Production-proven with two initially unconnected notes. Trace `3e3485c5-0233-4d8b-ab96-ee103958a986` searched, traversed, inspected exact details, applied one child plus one `relatedTo` edge, survived reload, and was absent after durable Undo plus reload. |
| Draft → self-evaluate → revise | Do not accept malformed, out-of-scope, or low-integrity writes | Replaced by schema parsing, semantic validation, and one bounded repair. No hidden self-score is treated as proof. |
| Sequential mutation queue | Avoid client synchronization races and preserve order | Ported as one grouped GraphStore transaction plus single-winner Convex checkpoint claim. |
| Pattern learning | Learn from success and failure without inflated scores | Replaced by bounded typed memories and patterns with success/failure counts. |
| Final answer/work product | Leave visible output, citations, steps, status, and recovery | Ported and authenticated in production: exact notebook citations, steps, durable receipt, reload recovery, and whole-run Undo observed. |

## Streaming event inventory

The legacy SSE contract was `client_action`, `thought`, `tool_call`, `tool_result`, `self_eval`, `final_summary`, `end`, and `error`.

| Legacy event | Current equivalent | Status |
|---|---|---|
| `client_action` | Typed checkpoint operations plus execution disposition | Ported only after a durable checkpoint exists; it never performs an optimistic graph write. |
| `thought` | Human-readable bounded step rationale | Ported as a safe summary; private chain-of-thought is never rendered or persisted. |
| `tool_call` | Durable step input digest, tool name, sequence, timestamps | Ported progressively from the sole engine. |
| `tool_result` | Durable step output digest and summary | Ported progressively from the sole engine. |
| `self_eval` | Deterministic validation and optional repaired step | Replaced; model self-judgment cannot certify itself. |
| `final_summary` | `finishSummary`, response, source citations, durable receipt | Ported as the final bounded SSE payload. |
| `end` | Terminal run/proposal status | Ported as the terminal stream event. |
| `error` | Honest stream error plus durable failed run/checkpoint where available | Ported; authenticated provider-timeout and invalid-checkpoint paths remain `Not completed` with no graph write. |

The current HTTP route uses content negotiation: JSON clients retain the bounded completed response, while the NodeBook UI requests SSE from the same `executeWorkflowAgent` execution path. There is no parallel streaming agent. Progressive UI events are observational; mutations still require a durable checkpoint and retain the existing receipt/undo lifecycle.

## Graph rendering decision

NodeBook uses pinned `@xyflow/react` 12.11.2 for interactive node/edge rendering. The runtime synapse map is composed from React Flow nodes and edges; it does not hand-draw a graph with SVG. This is the default for editable notebook mind maps because it provides React-native custom nodes, viewport behavior, selection, handles, and accessible interaction without a second rendering architecture.

Decision record (reviewed 2026-08-02):

| Library | Best use | NodeBook decision |
|---|---|---|
| React Flow | Editable React node UIs with embedded controls, selection, handles, pan/zoom, and custom nodes | Adopted as the sole NodeBook/NodeAgent graph renderer. |
| ELK.js | Deterministic layered/compound layout and edge routing | Add behind React Flow only when real graph-size evidence shows the current fixed or persisted layout is insufficient. |
| Cytoscape.js | Graph-theory analysis, compound graphs, and many layout extensions | Reserve for a separate analysis product requirement; do not duplicate the notebook editor renderer. |
| Sigma.js + Graphology | Read-only WebGL exploration of thousands of nodes and edges | Reserve for a proven large-graph exploration mode. |

The renderer boundary is scenario-tested in `src/app/query/RuntimeSynapseMap.test.tsx`: an eight-case suite must be capped to six visible workflows and passed to React Flow as accessible nodes and edges. This prevents a future visual refresh from silently replacing the graph with bespoke SVG markup.

- Add `elkjs` only when graph size or directed hierarchy makes deterministic automatic layout necessary; it is a layout engine, not a renderer.
- Consider Sigma.js only for a future read-only, thousands-of-nodes exploration mode where WebGL scale outweighs embedded React controls.
- Do not introduce D3 or bespoke SVG graph rendering for the NodeAgent UI. Existing inline SVG icon glyphs are outside this graph-rendering boundary.

## Inline interaction inventory

| Legacy interaction | Current disposition |
|---|---|
| `/mewagent <request>` at the current editing node | Renamed to `/nodeagent <request>`; opens the same integrated NodeAgent surface with current-node scope. |
| Agent root node plus `Final Answer` child | Replaced by one shared inline/sidebar NodeAgent thread so the agent does not litter the graph with control scaffolding. Work-product nodes are still created by typed operations. |
| Per-tool input/output child nodes | Replaced by the shared durable step/receipt surface. |
| Queued/executed/error node status | Replaced by checkpoint and durable run/proposal status. |
| Structured report rendered beneath Final Answer | Replaced by visible typed graph work products plus response/citations. |
| `/ai`, `/search`, `/deepresearch`, `/tot` | Not aliases for NodeAgent. They were separate legacy AI surfaces and are intentionally not reintroduced into the sole NodeAgent engine. |
| Standalone AI Search sidebar | Reuses `NodeAgentInterface`; no second agent implementation remains. |
| Route navigation from inline invocation | `nodebook:nodeagent-invoke` opens the existing shared thread and carries query/root context. |

## Reliability replacements that must not regress

- Auth0 identity and owner-scoped Convex reads/writes.
- Typed operation schemas and reviewed-ID scope validation.
- Sorted-key deterministic digests and exact `{sourceId, version, digest}` bindings.
- Bounded context, retrieval candidates, graph relations, operations, memories, model candidates, response bodies, and stored update payloads.
- Independent catalog/model timeouts and provider failure propagation.
- Durable run, step, checkpoint, proposal, memory, and model-evaluation records.
- Checkpoint → automatic execution for low-risk reversible work → receipt → whole-run undo.
- Optional Plan preview and explicit approval only at high-risk boundaries.
- One typed `NotebookTools` UI port for checkpoint claim, graph application, durable transitions, rejection, and Undo; conflicts are data and a losing tab never marks the winner failed.
- One run-wide provider ledger that includes repair usage, fails closed on missing usage telemetry, caps observed spend, and preserves a durability deadline reserve.

## Remaining parity proof

Implementation is not behavioral proof. Completion still requires one authenticated production evidence set covering:

1. The six locked Notion cases run through the bounded authenticated `/api/query/evals` production runner and currently report 6/6. Keep the corpus immutable; add newly discovered cases to the exploratory suite rather than weakening certification.
2. Ask, Plan, safe Auto, destructive approval pause, applied receipt, reload recovery, and whole-run Undo are production-proven. On 2026-08-02, a signed two-tab production race opened one durable proposal in both tabs: one checkpoint applied, the competing tab failed honestly with `Proposal is already applied`, Undo persisted as `undone` after reload, and an exact notebook search found no remaining temporary node.
3. Model/usage presentation remains; exact steps/citations and honest provider failure are production-proven.
4. Refresh the final desktop, tablet, and phone end-to-end clips after the latest live-session hardening. The 2026-08-02 authenticated desktop proof now covers progressive trace-before-receipt behavior; responsive clips remain.
5. Typed-memory inspect, pin/unpin, and cited graph projection are authenticated-production-proven. The projection created one readable memory node plus seven exact source relations, persisted its `nodebook` deterministic receipt across reload, and was absent after Undo plus reload. Forget remains production-shaped scenario coverage only to avoid deleting a real learned memory for demonstration.
6. Person and company deep-dive parity are authenticated-production-proven. The person run completed five of six searches and applied a seven-operation hierarchy. The company run first exposed honest provider-incomplete and underspecified-draft failures; after correction, it completed six of six searches, materialized five evidence-receipt sections, applied six operations, and was absent after durable Undo plus reload. Auto prose is normalized so the durable checkpoint receipt remains authoritative over stale model approval language.
7. A signed one-node plan exposed a model-quality regression: four semantically identical `run_specialized_workflow` calls with paraphrased rationales consumed 27,459 tokens. The deployed repeat guard now keys each tool on the fields that affect execution. A final signed trace persisted exactly one specialized-workflow step before the repeated-call checkpoint, used 18,711 tokens (31.8% below the original run), and incremented the live model-quality failure counter without treating degraded semantic retrieval as a model failure.
8. Signed snapshot hydration exposed repeated inaccessible legacy relation-list references. The complete eight-stream Convex read boundary now prunes only positions whose relation document is absent from the owner-visible snapshot. A fresh signed production tab rendered the original notebook shell with zero NodeBook application warnings/errors; extension-only warnings were classified separately.
