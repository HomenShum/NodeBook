# NodeAgent structured research — authenticated production proof

- Production URL: `https://nodebook-rho.vercel.app`
- Deployment: `dpl_AJGymF71N9fNTAQ27N371HhQ7Zc3` (`Ready`)
- Git commit: `9cb03037` (includes provider compatibility fix `f56a45b5`)
- Viewport: signed Chrome desktop session
- Exact query: `Research Web3 and its core components`
- Mode: Agent / Plan, web research enabled, one-time OpenAI context egress approved

## Observed success

1. `generate_targeted_queries` prepared six bounded topic queries across five aspects.
2. `parallel_web_research` completed four of six searches; two failed or returned invalid evidence without aborting the useful results.
3. `synthesize_structured_research` exposed 13 web sources.
4. Deterministic validation rejected the shallow two-operation draft; `repair_proposal` produced one container plus five independently readable section nodes.
5. Plan mode displayed six exact `create_node` changes and left `Checkpoint: pending`.
6. `Apply plan` produced `Checkpoint: applied`, a durable receipt, and an `Undo this run` action.
7. Reload preserved the applied receipt and all five section operations.
8. Whole-run Undo produced `Checkpoint: undone`; the Web3 graph node was absent.
9. Reload preserved `Checkpoint: undone`; the disposable Web3 hierarchy remained absent.
10. Final application-console error count was zero.

Run receipt: `12212d6e-7861-4475-a82f-abc296c9449a`.

## Automatic free-model benchmark v4

The production release benchmark completed against four current free, tool-capable structured-output candidates. No model passed any complete locked workflow, so the free route correctly remains uncertified and NodeBook falls back to its configured OpenAI route. The strongest diagnostic candidate was `google/gemma-4-26b-a4b-it:free` at 58.3% of individual criteria but 0/6 complete cases; partial credit cannot promote a route. Hourly catalog fingerprint checks and the three-consecutive-failure trigger remain active.

## Root-cause corrections found by live proof

- GPT-5 mini web tools reject `reasoning.effort=minimal`; web calls now use tool-compatible `low`, while non-web calls remain `minimal`.
- The original 800-token finding cap could truncate reasoning plus strict structured output; it is now 1,600 tokens with the existing 4,000-character schema cap.
- Web searches retain a 30-second per-call timeout, six-query maximum, parallel execution, bounded provider-body reads, and honest partial-failure accounting.

## Evidence files

- `before.png`: original production two-node placeholder.
- `change-boundary.png`: labeled UI mutation boundary.
- `after-plan.png`: populated structured Plan and tool receipts.
- `after-populated.png`: applied checkpoint.
- `reloaded-applied.png`: applied state after reload.
- `undone.png`: whole-run Undo result.
- `reloaded-undone.png`: clean state after reload.
