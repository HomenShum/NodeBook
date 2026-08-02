# NodeAgent final live workflow evidence

Date: 2026-08-02

This ledger is populated only from signed production observations against `https://nodebook-rho.vercel.app`.

## Deployment under test

- Commit: `fd6297a5` (`Restore exact NodeAgent rollback state`)
- Vercel deployment: `dpl_DV19oRvg4jx4mrnKxhCWoEUxg9zG`
- Production alias: `https://nodebook-rho.vercel.app`
- Vercel state: `READY`
- Raw alias response: HTTP 200; contains `NodeBook`; contains neither `Mew` nor `Ideaflow`.

## Durable rollback knockout

Signed owner session, exact parent: `QA-20260802 Rollback Meeting Gamma` (`d881d649`).

1. Agent Auto request: create exactly one child named `QA-20260802 Rollback Temporary Child` and change no other note.
2. The bounded planner stopped a repeated specialized-workflow call, then deterministic repair completed one `create_node` checkpoint.
3. Durable trace: `5e1a15e6-8ca8-4023-9d7b-0cc8b5edb337`.
4. Applied state: the child rendered as a real notebook row; receipt reported `Checkpoint: applied` and `durable`.
5. Reload: the child row remained; reopening AI restored the same applied receipt and Undo action from the URL-bound proposal.
6. Undo: receipt changed to `Checkpoint: undone`; exact child textbox count became zero.
7. Second reload: exact child textbox count remained zero; reopening AI restored the durable `undone` receipt.

This closes the previously failing persistence boundary: structural rollback and derived node state now survive a fresh client hydration.

## Earlier integrated workflow observations

- Multi-level Web3 research completed with notebook retrieval, five-aspect web research, a seven-operation structured checkpoint, 16 web sources, applied reload persistence, Undo, and clean-reload persistence. Trace: `7ca06baf-e2b3-476c-add8-747637bd48b0`.
- Exact organization planning selected only the three prefixed meeting notes, created one destination folder, and emitted three moves with three versioned notebook citations. Trace: `2d3ff0a8-6388-4aab-8f2a-8f14dd746391`.
- Opening the original fixture after its prior Undo showed the correct four structural children. Its stale displayed count was reproduced locally as `relationCount: 2` versus the correct baseline `5`, then fixed by the strict multi-step rollback comparator and persisted-reload regression.

## Honest caveat / cleanup

- A disposable QA parent note deletion opened NodeBook's confirmation dialog, but the browser-control kernel timed out while accepting it. Deletion is therefore unverified and remains a cleanup check, not a claimed success.
- Continuous tablet/phone video proof and the remaining locked live-eval cases are not closed by this ledger.
