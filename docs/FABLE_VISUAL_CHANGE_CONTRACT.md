# Fable UI Change Contract Gate

Use this gate for every task that changes a rendered or interactive surface. It runs after Fable has gathered evidence and committed to one recommendation, but before the first behavior-changing edit.

## Gate objective

The user and implementer must be able to point to the exact current surface, the exact boundaries that may change, the states the change must produce, and the surrounding UI that must remain unchanged.

## Required artifacts before implementation

1. **Observed baseline** — capture the real current UI before editing. Record URL, revision, authentication mode, viewport, theme, data fixture, and timestamp. A mock or reconstructed screen cannot be called the baseline.
2. **Boundary map** — overlay numbered boxes on the baseline. Every box maps to one titled change. Gray or unboxed areas form the preservation contract.
3. **Expected-state board** — render the proposed result in the existing application shell. At minimum show empty, loading/running, populated/success, degraded/error, and narrow/mobile states when applicable.
4. **State contract** — for every numbered boundary, state what changes, what remains, the user action that reaches it, its honest data source, and its verification signal.
5. **Alignment checkpoint** — when the user asks to preview the UI, or the change alters navigation/information architecture, show the artifacts before implementation. Do not treat silence as approval for a materially different shell.

All proposed visuals must carry an **EXPECTED / SAMPLE DATA** label. They are specifications, never evidence that the feature exists.

## Scope-lock format

| ID | Surface | Planned change | Preserved behavior | Required states | Verification |
| --- | --- | --- | --- | --- | --- |
| UI-1 | Existing control or region | One bounded change | Explicit invariants | Empty/loading/success/error | DOM + pixels + interaction |

If implementation needs a surface outside this table, stop and update the contract before editing it.

## Verification after implementation

1. Capture the same URL, viewport, theme, fixture, and state used for the observed baseline.
2. Produce actual-after captures for every required state; do not substitute the expected mock.
3. Compare actual-after against each numbered boundary and the preservation contract.
4. Record every variance as **accepted**, **rejected**, or **unresolved** with its reason.
5. Re-run keyboard, accessibility, console, responsive, degraded-provider, and surrounding-journey checks.
6. Save baseline, expected board, actual-after artifacts, DOM/console evidence, and the variance ledger together.

The change cannot pass Fable verification when a planned boundary lacks an actual-after artifact, when a preserved area regresses, or when the expected mock is presented as completed work.

## NodeBook contract for this increment

Reference artifacts:

- `evidence/nodeagent-visual-contract-20260801/nodeagent-original-shell-contract.png`
- `evidence/nodeagent-visual-contract-20260801/anonymous-entry-contract.png`

| ID | Surface | Planned change | Preserved behavior |
| --- | --- | --- | --- |
| NB-A1 | Existing top-toolbar `AI` button | Open the NodeAgent drawer | Location and notebook toolbar remain |
| NB-A2 | Existing AI right sidebar | Replace the scattered AI Search contents with NodeAgent | Original notebook stays visible and usable |
| NB-A3 | Drawer composer and modes | Add Ask, Agent, and Organize | One composer remains the hero |
| NB-A4 | Execution preflight | Show model route, read/write scope, privacy, research, and per-run consent | No egress before consent |
| NB-A5 | Run status | Show durable, honest execution state | No optimistic completion |
| NB-A6 | Response and trace | Show response, plan, and bounded tool trace | Notebook context remains visible |
| NB-A7 | Proposal | Preserve review, reject, accept/apply, and undo semantics | No silent graph mutation |
| NB-A8 | Receipt | Show model, route, usage, latency, cost, evidence, privacy, benchmark, digest, and persistence | Receipt must match execution |
| NB-G1 | Login screen | Add `Continue as guest` | Auth0 `Sign in` and phone handoff remain |
| NB-G2 | Guest shell | Show `Guest · local sandbox` and `Sign in to sync` | Original notebook shell remains |

Guest safety contract: isolated demo dataset, local-only notebook mutations, no authenticated Convex reads or writes, rate-limited demo-agent calls, no web research initially, bounded session lifetime, and an explicit clear-session control.
