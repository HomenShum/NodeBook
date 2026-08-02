# UI change boundary

Route: authenticated production notebook route with embedded AI sidebar open
Viewport: 1440x900
Theme: current light theme
Session: signed-in owner, preserved Chrome profile
Trigger: click the existing `AI` toolbar button
Fixture/input: existing completed-and-undone NodeAgent run shown in `before.png`

## CHANGE A · NodeAgent verification & receipt

Current: The result region shows response, plan, tool trace, checkpoint status, and a durable receipt, but the receipt omits provider/model/usage/digest and there is no user-triggerable way to execute the six locked legacy-parity cases.

Expected: Add one secondary, explicit `Runtime verification` disclosure inside the existing NodeAgent surface. It runs the same `/api/query/evals` engine one case at a time, never applies graph operations, and restores durable evaluation receipts after reload. Extend the normal run receipt to expose its existing provider/model/usage fields. Do not create another agent surface or engine.

Modernization inside this boundary: Place a compact receipt-backed synapse map and summary strip at the top of the disclosure. NodeAgent is the center node and the six locked cases are the only surrounding nodes. An edge is neutral before execution, highlighted only while that exact case is running, teal only after a durable PASS receipt, and tomato only after a durable FAIL receipt. The exact case list remains the accessible text fallback and evidence surface. No decorative or inferred activity is permitted.

Reference provenance: `design-dna/observations/nodeagent-runtime-verification.yml`, derived from live Mobbin inspection of Relevance AI task timelines, Gemini thinking steps, Arcade insight summaries, and Fibery relationship maps. Reference pixels are not stored.

Data sources: authenticated `GET/POST /api/query/evals`, `agentRuntimeEvaluations`, and the existing normal-run receipt.

| State | Expected visible result |
| --- | --- |
| Empty | `Runtime verification`, `Not run`, a neutral six-edge map, six locked legacy cases, and one `Run six cases` action; no fake model, scores, or receipt |
| Loading | `Running n of 6`, only the current case edge highlighted, current case title, completed-case count, and `Stop after current case`; server receipt controls truth |
| Error | Failed case, HTTP/runtime reason, completed receipts preserved, and `Retry failed case` / `Run remaining` recovery |
| Populated | Honest pass/fail/remaining summary, receipt-colored edges, benchmark version, actual provider/model, token usage, latency, each case disposition/reasons, persisted receipt IDs, and `Run again` |
| Overflow | Case names/reasons/digests wrap or scroll inside the sidebar without covering controls |
| Responsive | At 390x844 the sidebar remains vertically scrollable and every run/retry/receipt control is reachable |

Out of scope: notebook tree/canvas, search/filter toolbar, navigation, phone-handoff QR, note editing, Auto/Plan semantics, proposal application, and Undo.

Unchanged assertion: same notebook root, same completed-and-undone run, same mode/preflight controls, same phone-handoff entry point, and no synthetic evaluation operation reaches the graph apply path.

## Empty → populated reference

```text
BEFORE · EMPTY                         AFTER · POPULATED
┌ Runtime verification ───────────┐    ┌ Runtime verification · Complete ─┐
│ Not run                         │    │ 5/6 passed · runtime-v1           │
│ Six locked legacy cases         │    │ OpenAI · gpt-5-mini · 21.4s      │
│ No evaluation receipt yet       │    │ 1 Research container       PASS  │
│ [Run six cases]                 │    │ 2 Organize meetings        FAIL  │
└─────────────────────────────────┘    │ Receipt IDs · tokens · reasons    │
                                       │ [Retry failed] [Run again]         │
                                       └────────────────────────────────────┘
```
