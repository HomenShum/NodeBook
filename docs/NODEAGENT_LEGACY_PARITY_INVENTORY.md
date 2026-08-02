# NodeAgent legacy parity inventory

Date: 2026-08-01

This is the durable migration ledger for the in-place MewAgent-to-NodeAgent port. It inventories both recoverable legacy generations and records whether each behavior is ported, intentionally replaced, or still requires live proof. Historical names appear here only as provenance; shipped product copy and commands use NodeBook and NodeAgent.

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
| `execute_multi_step_research_plan` | Both | Replaced / proof pending | Bounded investigation loop plus `run_specialized_workflow:research`; live multi-level research case remains pending. |
| `generate_report_outline` | Both | Replaced | Structured plan and typed `create_node` sequence; no separate outline tool is exposed. |
| `populate_report_from_outline` | Both | Replaced / proof pending | Container-first graph operations cover the work product; production hierarchy quality remains a live case. |
| `execute_direct_request` | Both | Ported | Ask/Agent modes synthesize from bounded notebook context; Ask is read-only. |
| `evaluate_and_enhance_report` | Both | Replaced | Deterministic semantic validation plus one bounded repair. The old free-form self-score is not trusted. |
| `find_nodes` | Google internal SOP | Ported | Owner-scoped full-text + lexical retrieval and current-root weighting in `contextSnapshot`; iterative planner can choose it. |
| `find_related_nodes_via_graph` | Both | Ported | Bounded relation expansion marks and returns `graph_neighbor` context. |
| `get_node_details` | Broken/missing Google dependency | Ported | Typed bounded lookup over reviewed context; unknown IDs fail closed. |
| `get_note_index` | Google | Ported | Organization mode loads a bounded owner-scoped index and emits a durable step. |
| `get_all_notes_raw` | Google | Replaced | Owner-scoped bounded Convex snapshot; the model never receives an unbounded raw dump. |
| `get_notes_with_content` | Google internal | Replaced | Hydrated, chunk-aware Convex documents with response/context byte caps. |
| `research_company_deep_dive` | Both | Replaced / proof pending | Generic research workflow and container-first operations; dedicated company algorithm is not copied. |
| `research_person_deep_dive` | Both | Replaced / proof pending | Generic research workflow and reuse instructions; dedicated person algorithm is not copied. |
| `research_and_update_profile_section` | Both | Replaced / proof pending | Update workflow plus exact source bindings; live profile case remains pending. |
| `get_company_profile` | Google | Replaced | Existing-note retrieval and exact-node inspection supersede a domain-specific getter. |
| `get_person_profile` | Google | Replaced | Existing-note retrieval and exact-node inspection supersede a domain-specific getter. |
| `research_and_create_notes` | Google | Replaced / proof pending | Research workflow emits typed container/child operations. |
| `create_knowledge_map` | Both | Replaced / proof pending | Connect workflow emits typed nodes and relations; Mamba/SSM live case remains pending. |
| `analyze_and_reorganize_notes` | Google internal | Replaced / proof pending | Organization workflow operates on a bounded index; meeting-note live case remains pending. |
| `find_and_intelligently_clone_nodes` | Google | Replaced / proof pending | Search/reuse policy plus typed `clone_node_hierarchy`; existing-profile live case remains pending. |
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
| `create_hierarchy_and_move_nodes` | Legacy client composite | Replaced / proof pending | Ordered `create_node` + `move_node` operations execute as one checkpointed transaction. |
| `update_profile_section` | Legacy client composite | Replaced | Typed update operations and source bindings. |
| `create_hierarchy_from_outline` | Legacy client composite | Replaced | Ordered temporary-ID graph operations. |
| `create_profile_from_json` | Legacy client composite | Replaced | Typed bounded graph operations; arbitrary JSON-to-graph mutation is intentionally not restored. |
| `superconnector_prepare_outreach` | OpenAI | Deferred | External side effect is outside the notebook parity wedge and would require an integration/approval boundary. |
| `superconnector_schedule_event` | OpenAI | Deferred | External scheduling is outside the notebook parity wedge and would require an integration/approval boundary. |
| `finish_work` | Both | Ported | Terminal durable `finish_work` step and receipt. |

## Workflow inventory

| Legacy workflow | Required preserved behavior | Current state |
|---|---|---|
| Search broadly → inspect clues → traverse graph → specialize → finish | Iterative, bounded, notebook-first sensemaking | Ported as at most four planner decisions plus final synthesis; production trace proof pending. |
| SOP A: hybrid synthesis | Combine multiple existing notes without duplication | Ported in instructions/retrieval; live Notion proof pending. |
| SOP B: deep knowledge organization | Create one container before children and preserve hierarchy | Ported in typed operations/instructions; live Notion proof pending. |
| SOP C: multi-entity research | Reuse existing entity profiles and research only gaps | Ported in instructions/clone operation; live Notion proof pending. |
| Organization | Find exact bounded matches, create folder, move only matches | Ported; live three-meeting case pending. |
| Connection | Reuse both nodes, create explanation child, add relation | Ported; live Mamba/SSM case pending. |
| Draft → self-evaluate → revise | Do not accept malformed, out-of-scope, or low-integrity writes | Replaced by schema parsing, semantic validation, and one bounded repair. No hidden self-score is treated as proof. |
| Sequential mutation queue | Avoid client synchronization races and preserve order | Ported as one grouped GraphStore transaction plus single-winner Convex checkpoint claim. |
| Pattern learning | Learn from success and failure without inflated scores | Replaced by bounded typed memories and patterns with success/failure counts. |
| Final answer/work product | Leave visible output, citations, steps, status, and recovery | Ported and authenticated in production: exact notebook citations, steps, durable receipt, reload recovery, and whole-run Undo observed. |

## Streaming event inventory

The legacy SSE contract was `client_action`, `thought`, `tool_call`, `tool_result`, `self_eval`, `final_summary`, `end`, and `error`.

| Legacy event | Current equivalent | Status |
|---|---|---|
| `client_action` | Typed checkpoint operations plus execution disposition | Durable replacement; no optimistic mutation stream. |
| `thought` | Human-readable bounded step summary | Replaced; private chain-of-thought is not rendered or persisted. |
| `tool_call` | Durable step input digest, tool name, sequence, timestamps | Ported after each bounded investigation. |
| `tool_result` | Durable step output digest and summary | Ported after each bounded investigation. |
| `self_eval` | Deterministic validation and optional repaired step | Replaced; model self-judgment cannot certify itself. |
| `final_summary` | `finishSummary`, response, source citations, durable receipt | Ported. |
| `end` | Terminal run/proposal status | Ported. |
| `error` | Honest HTTP error plus durable failed run/checkpoint where available | Ported; authenticated provider-timeout and invalid-checkpoint paths observed as `Not completed` with no graph write. |

The current HTTP route returns the bounded completed result rather than SSE. Durable steps preserve semantics and reloadability, but progressive live rendering is a remaining UX gap—not evidence of missing execution.

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

## Remaining parity proof

Implementation is not behavioral proof. Completion still requires one authenticated production evidence set covering:

1. The six locked Notion cases now have a bounded authenticated `/api/query/evals` runner through the actual NodeAgent planner, validator, risk classifier, source binding, and digest pipeline; executing all six against production and capturing their durable receipts remains pending.
2. Live checkpoint-race proof remains; Ask, Plan, safe Auto, destructive approval pause, applied receipt, reload, and whole-run Undo are production-proven.
3. Model/usage presentation remains; exact steps/citations and honest provider failure are production-proven.
4. Refresh the final desktop, tablet, and phone end-to-end clips after the latest live-session hardening.
