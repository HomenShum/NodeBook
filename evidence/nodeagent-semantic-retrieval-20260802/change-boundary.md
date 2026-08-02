# UI change boundary — semantic retrieval receipt

Production: `https://nodebook-rho.vercel.app`
Route: signed-in owner-root notebook route (owner identifier redacted)
Viewport: 2048 × 1100
Theme: light
Session: signed-in owner, preserved Chrome profile
Trigger: open `AI Toggle AI Search`
Fixture/input: existing completed NodeAgent production run

## CHANGE A · NodeAgent run panel

Current: the populated panel shows the prior agent response, ordered tool trace, checkpoint, citations, memory, and durable receipt. Retrieval is reported only as `find_nodes`; no vector/semantic stage exists.

Expected: the same panel reports whether semantic retrieval completed or degraded before the legacy search/traversal workflow. Existing controls and receipt ordering remain intact.

Data sources: owner-scoped Convex node vector index, OpenAI embedding receipt, integrated NodeAgent run/step journal.

| State | Expected visible result |
| --- | --- |
| Empty | Existing examples, Ask/Agent/Organization modes, Auto/Plan choice, consent boundary, and primary run action remain unchanged; no fabricated retrieval receipt. |
| Loading | Existing running state remains available while the bounded semantic lookup and agent workflow execute. |
| Error/degraded | The ordered trace names `semantic_retrieval`, discloses the exact degraded reason, continues only with the existing lexical/graph fallback, and leaves retry available. |
| Populated | Provider/model identity, semantic retrieval status, ordered legacy workflow steps, notebook citations, checkpoint/receipt, and primary next action remain visible. |
| Overflow | Long retrieval or provider failure text wraps inside the panel without covering actions or the notebook canvas. |
| Responsive | At 390 × 844, panel reading order and primary run/retry action remain reachable without horizontal page overflow. |

Out of scope: notebook tree/canvas content, left navigation, breadcrumb, search/filter/sort controls, graph mutation layout, phone handoff, and runtime-verification assertions.

Unchanged assertion: same notebook root, signed session, light theme, selected proposal/run state, graph data, and 6/6 locked legacy-parity result.
