# production-agent.json — declared gaps

The contract in `production-agent.json` states only what exists in code. These are the
checklist items that do NOT exist, declared here instead of being faked in the contract.

## 1. No named golden metrics

The schema's `slos` floor expects `task-completion-rate`, `tool-call-error-rate`, and
`p99-latency-ms`. None of the three is instrumented anywhere in this repo. The three
clauses declared under `slos` are real *enforced bounds* (parity promotion score, token
fuse, provider deadline), not measured service-level metrics. Closing this gap means
emitting the three golden metrics from the run receipts already recorded in
`agentWorkflows` and asserting thresholds on them.

## 2. No deploy canary — `release.canary` intentionally absent

Deploys follow the manual operator runbook in `doc/PRODUCTION_CUTOVER.md` (freeze,
preview rehearsal, manual cutover, read-only rollback targets). There is no traffic
split and no automatic rollback at the deploy layer, so the schema-required
`release.canary` block (which mandates `rollbackMode: "automatic"`) cannot be filled
truthfully and is omitted. **Schema validation therefore reports exactly one error:
`/release` missing required property `canary`. That failure is the honest declaration.**
The closest real mechanism — the automatic model-route re-benchmark after three
consecutive failures — is declared under `runtimeGuards.circuitBreaker`, where it
actually lives.

## 3. Judge is rule-based, not LLM

Both judges are deterministic rule scorers: `scoreParityResult`
(convex/modelRouting.ts) and `scoreLiveEval` (src/app/api/query/evals/liveEval.ts).
There is no LLM-as-judge anywhere in the release path. `release.judgeRegression`
declares the rule-based suites that run in CI; do not read it as LLM judging.

## Validation

`node scripts/validate-production-agent.mjs` — compiles the copied
`production-agent.v1.schema.json` with the repo's ajv (v6, draft-07 engine; the
schema's keywords are draft-07 compatible, `$schema` is stripped at compile time) and
prints every error. Expected output: the single `/release` canary error from gap 2.
