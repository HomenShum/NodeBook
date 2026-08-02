# NodeAgent entity deep-dive production proof

Date: 2026-08-02

Deployment: `dpl_2jV1XPTBayjmcH2x2VcwF4JUb1sj` (`Ready`, production)

## Boundary

The visible boundary is unchanged from `change-boundary.png`: the NodeAgent query composer, mode controls, streamed tool trace, checkpointed graph changes, receipt, and notebook work-product region. This behavior change does not introduce a new renderer or layout.

## Signed person-profile scenario

Request: deep-dive a named historical person across professional background, education, major accomplishments, notable projects, and current roles.

Observed in the signed production NodeBook session:

- `generate_targeted_queries`: six bounded person queries across five aspects.
- `parallel_web_research`: five successful receipts and one honest failure/invalid receipt.
- `synthesize_structured_research`: seven checkpointed graph operations with 15 web sources.
- `repair_proposal`: one deterministic repair before execution.
- Final state: `Checkpoint: applied`, durable receipt, and the structured professional-profile container visible in the notebook.
- Cleanup: `Undo this run`, reload, `Checkpoint: undone`, and the exact profile container absent.
- Console: no new warning or error occurred during the run/undo window; older relation warnings predated this proof.

## Lower-layer gates

- Jest: 51 suites, 262 tests passed.
- Convex production contracts: 43 tests passed.
- Focused entity scenarios: person happy path and company unrelated-five-section repair passed.
- Typecheck and targeted lint passed.
- Next production build passed; existing hook warnings remain unchanged.
- Raw production HTML returned 200 and contained the `NodeBook` product signal.

## Honest limitation

The Chrome extension exposed signed DOM and durable graph state but did not support pixel screenshot capture for this tab. No new pixel-fidelity claim is made. Existing before/boundary/populated screenshots in this evidence directory remain the visual reference for the same NodeAgent region.

## Signed company-profile scenario

Request: deep-dive a named public company across overview and mission, products and business model, funding and financial signals, leadership and team, and competitive landscape.

The proof intentionally retained two failed attempts as diagnostic evidence:

1. All six searches succeeded, but the 2,500-token generic synthesis ceiling returned an incomplete structured response before a checkpoint.
2. After correcting phrase parsing and raising the still-bounded entity synthesis ceiling to 5,000 tokens, both draft and repair returned only one work product. The run failed deterministic validation and performed no graph write.
3. The final architecture materialized entity sections directly from complete aspect-search receipts instead of asking the same model to certify its own structure.

Final signed production observations:

- Five comma-delimited company aspects remained intact; internal `and` phrases were not split.
- Six of six bounded searches succeeded.
- Five exact evidence-backed aspect sections plus one company container produced six typed operations.
- Deterministic validation passed without model self-repair.
- `Checkpoint: applied` and a durable receipt were visible; the notebook showed one company container with five children.
- `Undo this run` followed by reload produced `Checkpoint: undone`; the exact company container was absent.
- No new console warning or error occurred during the final run/undo window.
- A deterministic Auto-language normalizer removes stale model requests for per-run approval and states that the checkpoint receipt is authoritative.

Final production deployment for the Auto-language correction: `dpl_3RKoPcBSXZLxaQQhQ2G7YVoJvk3Q` (`Ready`).
