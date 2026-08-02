# UI change boundary — NodeAgent structured deep research

Route: signed-in owner root on `https://nodebook-rho.vercel.app`
Viewport: 2560 × 1431, device pixel ratio 1
Theme: light
Session: signed-in owner Chrome session
Trigger: open AI → Agent → Plan; submit `Research Web3 and its core components`
Fixture/input: the exact original Notion-authored MewAgent example, with web research disabled for the untouched baseline

## CHANGE A · NodeAgent run panel

Current: the specialized workflow reports only two planned operations—a research container and one summary child—and asks for another confirmation even though the user deliberately selected Plan.

Expected: the same panel exposes the legacy composite stages, a bounded structured work-product outline, honest notebook/web evidence, exact operation count, checkpoint status, and the existing Apply/Reject recovery actions. Plan remains preview-only.

Data source: durable run/step/proposal receipt plus structured research work products.

| State | Expected visible result |
| --- | --- |
| Empty | Existing NodeAgent mode/execution controls and no fabricated run data. |
| Loading | Run remains identifiable; progressive legacy composite stages appear without claiming completion. |
| Error | Exact failed stage and provider failure remain visible; no partial graph mutation in Plan. |
| Populated | NodeAgent/model identity, ordered multi-search/synthesis stages, structured hierarchy operations, evidence/receipt, and Apply plan. |
| Overflow | Long research sections and citations wrap/scroll inside the panel without covering checkpoint actions. |
| Responsive | Panel remains usable at the existing desktop layout; responsive capture is a later final-clip requirement. |

## CHANGE B · Graph work-product region

Current: the untouched Plan creates no graph nodes; if applied, its contract would create only one container plus one flat summary child.

Expected: applying Auto or Apply plan materializes one bounded structured research hierarchy under the current root; Undo removes the whole checkpoint.

Data source: typed `create_node` operations using deterministic temporary IDs.

| State | Expected visible result |
| --- | --- |
| Empty | Existing notebook outline remains unchanged before application. |
| Loading | No partial node hierarchy is presented as complete. |
| Error | Existing graph remains intact and the failed checkpoint is disclosed in CHANGE A. |
| Populated | One research container with nested, independently readable section nodes appears in the existing outline. |
| Overflow | Long section bodies remain editable and do not displace neighboring root controls. |
| Responsive | Existing outline behavior remains unchanged; final phone/tablet clips remain out of this slice. |

Out of scope: left navigation, breadcrumb, search/filter/sort controls, QR handoff, display controls, memory-card styling, and React Flow rendering architecture.

Unchanged assertion: same signed owner, current root, light theme, notebook outline, mode controls, checkpoint/receipt component, and `@xyflow/react` graph renderer.
