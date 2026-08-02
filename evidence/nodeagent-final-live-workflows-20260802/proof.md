# NodeAgent final live workflow evidence

Date: 2026-08-02

This ledger is populated only from signed production observations against `https://nodebook-rho.vercel.app`.

## Latest deployment under test

- Commit: `d3867ab5` (`Keep Ask mode read-only across workflows`)
- Vercel deployment: `dpl_6KjTw7so3SXzbXyJ7Y8CvYewqaVe`
- Production alias: `https://nodebook-rho.vercel.app`
- Vercel state: `READY`
- Raw alias response: HTTP 200; contains `NodeBook`; contains neither `Mew` nor `Ideaflow`.

## Current-deployment responsive end-to-end clips

Both clips use the existing signed Chrome/Auth0 session and the exact production alias after deployment `dpl_6KjTw7so3SXzbXyJ7Y8CvYewqaVe` became Ready. Each is a continuous 2 fps page capture of one uninterrupted UI journey.

- Phone: `nodebook-phone-390x844-e2e.mp4`; 390x844; 50 frames; 25.0 seconds; SHA-256 `8AEDECF3AE117AA612C42D01C6A238792CD5FEA89C7ADE3D5F0FD7B0CD36018F`.
- Tablet: `nodebook-tablet-768x1024-e2e.mp4`; 768x1024; 56 frames; 28.0 seconds; SHA-256 `4E61E0A58CA0F6E875C55ECC744315093BF7ACD7E058303B37756D6E081A2D7F`.
- Exact formerly failing Ask query: `Which two QA investor fixtures are visible in this notebook root?`
- Phone read-only trace: `7c5116a7-1365-462c-aa0f-bd2d80d2ea7d`; completed with two exact notebook citations, no checkpointed graph changes, a durable receipt, and 10,858 observed tokens.
- Tablet read-only trace: `86e105f8-448d-41a9-ac6d-ce4fadc2f83c`; completed with two exact notebook citations and no checkpointed graph changes.
- At each viewport, Agent Auto created one uniquely named temporary child, rendered `Checkpoint: applied`, exposed `Undo this run`, changed to `Checkpoint: undone`, and ended after a clean reload with the temporary child absent.
- Final viewport checks: phone `innerWidth=390`, `innerHeight=844`, `scrollWidth=390`; tablet `innerWidth=768`, `innerHeight=1024`, `scrollWidth=768`; zero application console errors at both endpoints.
- Visual inspection covered an in-progress applied child and the fully rehydrated final notebook at both sizes.

The first phone attempt before commit `d3867ab5` exposed an honest read-only failure: the words `investor/profile` forced a mutating legacy workflow, which Ask correctly rejected. Root cause was keyword classification that ignored mode. The deployed fix makes Ask return no deterministic mutation workflow and converts any planner-requested `run_specialized_workflow` or `create_knowledge_map` tool into a bounded read-only finish. The exact failed query then passed live as the traces above.

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

## Existing-note connection knockout

Signed owner session, exact existing notes: `QA-20260802 Mamba architecture` (`f62f7064`) and `QA-20260802 State Space Models` (`e3c9ab77`).

1. The first production replay failed after `find_nodes -> semantic_retrieval -> find_related_nodes_via_graph` because the optional model planner timed out before a deterministic required stage could run.
2. Root cause closure moved the required legacy workflow spine ahead of the optional planner and separated graph traversal evidence from mutation-target selection. The scenario regression makes the planner throw, supplies two unconnected retrieval candidates plus an unrelated current root, and still requires the exact Mamba-to-SSM operation pair.
3. Deployed replay trace: `3e3485c5-0233-4d8b-ab96-ee103958a986`.
4. Live tool order: `find_nodes -> semantic_retrieval -> find_related_nodes_via_graph -> get_node_details -> finish_investigation -> synthesize_from_notebook -> validate_proposal -> finish_work`.
5. The durable checkpoint applied exactly two operations. Mamba rendered exactly one Connection child; opening it showed `relates to: QA-20260802 State Space Models` and `parent: QA-20260802 Mamba architecture`.
6. Reload retained both visible relation endpoints.
7. Reopening the URL-bound proposal restored the applied receipt and Undo control. Undo changed both checkpoint and durable receipt status to `undone`.
8. The Mamba page then showed no Connection child and no stale child-count signal; a second reload remained clean.

This closes the locked connection case with real unconnected notes. The runtime verifier's earlier synthetic 6/6 badge was not accepted as proof after the first live replay contradicted it.

## Profile gap-fill causal closure

Initial signed replay trace: `21b04639-610a-45ab-9194-b916cbb820b9`.

- Symptom: a root-sibling `Leadership / Unknown` note received the evidence child while the requested `QA-20260802 Acme Profile Gap Fixture` remained empty.
- Boundary: retrieval returned `graph_neighbor`/title signals but no typed parent identity to the sole workflow.
- Mechanism: the gap selector treated exact section-title similarity as containment evidence.
- Upstream cause: `contextSnapshot` discarded child-relation direction and type after using relations for neighbor expansion.
- Missing guard: the scenario had a competing semantic profile but no same-titled sibling with a different parent.
- Rollback: the applied receipt was undone through its visible `Undo this run` control; reload of the sibling showed no evidence child and no stale count.
- Repair: owner-scoped bounded context now carries sorted `parentSourceIds`; they are included in deterministic source digests. Gap-fill accepts a section only when its exact parent is the reviewed profile and safely creates a missing section beneath that exact profile while ignoring same-titled nodes with other or incomplete ancestry.
- Second live symptom: the first corrected apply placed `Leadership` beneath the exact profile, but inspecting the created subtree advanced derived node version/relation metadata. Undo initially refused with `changed after the checkpoint`.
- Rollback root cause: reconciliation compared derived node metadata even though the relation receipt is the authoritative structural boundary. The repaired comparator protects created-node content and visibility, validates relation endpoints/type/publicity independently, and rebases deletion to the current version. Adversarial scenarios still reject a real content edit and a user move.
- Final clean signed trace: `55fcc436-25b1-4a85-9545-3def6ed08f98` on profile `QA-20260802 OpenAI Profile Gap Rollback Fixture` (`f9568379`).
- The applied receipt emitted exactly two operations, created `Leadership` (`fbcaaf4b`) under that profile, and created exactly one evidence child. A separate fresh tab loaded the exact child URL and rendered the evidence.
- After that hydration churn, the URL-bound durable receipt rehydrated from `proposalId`, Undo changed the checkpoint to `undone`, and the profile immediately lost the `Leadership` row. A clean production reload still showed the profile with no `Leadership` child.
- Production deployment: `dpl_4CEPmTSWrdxnE6MimQdF958y9jm3`, commit `5ac0a094`; alias returned HTTP 200 with `NodeBook=true`, `Mew=false`, and `Ideaflow=false`.

## Existing-profile reuse and missing-profile creation

Signed owner trace: `40a32be8-694c-4c3f-b8cf-d95d6fba9a29`.

1. Exact reviewed fixtures were `QA-20260802 Ada Ventures complete profile with thesis` (`f31fde24`) and `QA-20260802 Beacon Capital needs a profile`.
2. The sole engine emitted exactly three operations: create one `Investors` container, `clone_node_hierarchy` from the reviewed Ada profile, and create only the missing Beacon profile.
3. Because hierarchy expansion is high impact, Auto stopped at a durable `pending` checkpoint with the explicit message that cloning requires approval. No graph write occurred before `Approve and run`.
4. After approval, checkpoint status became `applied`. The exact `Investors` container (`fced31fd`) rendered two children: the cloned Ada profile and `QA-20260802 Beacon Capital / Profile research required.`
5. A separate tab loaded the exact container URL and a second reload retained both children.
6. The URL-bound receipt exposed whole-run Undo. Undo changed the checkpoint to `undone`; the root immediately lost `Investors`.
7. A clean root reload still had both original source fixtures and no generated `Investors` container, proving reuse rather than destructive movement or duplication of the originals.

## Earlier integrated workflow observations

- Multi-level Web3 research completed with notebook retrieval, five-aspect web research, a seven-operation structured checkpoint, 16 web sources, applied reload persistence, Undo, and clean-reload persistence. Trace: `7ca06baf-e2b3-476c-add8-747637bd48b0`.
- Exact organization planning selected only the three prefixed meeting notes, created one destination folder, and emitted three moves with three versioned notebook citations. Trace: `2d3ff0a8-6388-4aab-8f2a-8f14dd746391`.
- Opening the original fixture after its prior Undo showed the correct four structural children. Its stale displayed count was reproduced locally as `relationCount: 2` versus the correct baseline `5`, then fixed by the strict multi-step rollback comparator and persisted-reload regression.

## Honest caveat / cleanup

- The Mamba/SSM mutation was removed through the supported durable Undo path; both retained QA source fixtures remain for repeatability.
- Earlier rollback/organization fixtures remain in the signed notebook and are named with the `QA-20260802` prefix.
- Current-deployment continuous phone/tablet proof is complete in the two MP4 artifacts above. The retained prefixed QA source fixtures remain intentionally available for repeatable regression runs.
