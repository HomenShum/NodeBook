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
