# NodeAgent signed two-tab checkpoint race proof

Date: 2026-08-02

Production deployment: `dpl_56hGLtLvdjB5EomMnAUe3cYFUYTf` (`READY`), aliased to `https://nodebook-rho.vercel.app`.

## Scenario

A signed-in owner used the original NodeBook notebook shell at a fixed 1440x1000 viewport. NodeAgent Plan mode prepared exactly one reversible operation: create a temporary child note under the current root. Web research was disabled. Both signed tabs opened the same durable proposal URL and invoked **Apply plan** concurrently.

Trace: `4e33fb3a-3070-454b-ae93-64d793d3583c`

## Observed outcome

- Primary tab: `Checkpoint: applied`; durable receipt status `applied`.
- Competing tab: `Checkpoint: failed`; durable receipt status `failed`; visible notification `Proposal is already applied`.
- The accepted mutation rendered the requested temporary title and body.
- Primary tab exposed **Undo this run**. Undo changed the durable receipt to `undone`.
- After a full signed reload, reopening the proposal returned the same `undone` trace receipt.
- An exact notebook search for the temporary title returned no matching node and only the root editor empty state.
- The viewport remained 1440x1000 with no document-level horizontal overflow.

## Pixel evidence

- `01-plan-pending.png`: bounded one-operation plan before mutation.
- `02-primary-applied.png`: accepted checkpoint with Undo available.
- `03-second-conflict.png`: competing tab's durable failed receipt.
- `04-undo-reload.png`: signed notebook after Undo and reload.

## Production gaps observed during this scenario

1. The one-node plan consumed 27,459 tokens and called `run_specialized_workflow` four times before completing. The deterministic proposal was correct, but the tool loop is wasteful and should trip the automatic model/orchestration evaluator.
2. Signed graph hydration repeatedly logged `Relation with id ... does not exist` warnings for dangling legacy relation references. They did not block the checkpoint race, but they are a real migration-integrity gap.
3. The competing tab reports an honest failure instead of silently succeeding, but the copy is mechanically concatenated as `Not completedProposal is already applied`; presentation should be cleaned up without weakening the 409 conflict.

## Claim boundary

This proves single-winner checkpoint application, durable conflict disclosure, and reload-persistent Undo for one signed production owner. It does not prove provider-step replay across a process crash; the provider-response-before-Convex-write crash window remains documented separately.
