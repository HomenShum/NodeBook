# production-agent.json — declared gaps

The contract in `production-agent.json` states only what exists in code. These are the
checklist items that do NOT exist, declared here instead of being faked in the contract.
(The former golden-metrics gap is closed: `task-completion-rate`, `tool-call-error-rate`,
and `p99-latency-ms` are computed from persisted run receipts by the `goldenMetrics`
query in `convex/goldenMetrics.ts` and declared under `slos`.)

## 1. Deploy canary — partially closed; read `release.canary` precisely

`release.canary` is now declared, backed by two real mechanisms. Read it for exactly
what it is, no more:

- **Automatic rollback (exists, on the full deploy).**
  `.github/workflows/deploy-production.yml` smoke-checks the live production alias
  after a production deploy — via an operator-triggered `workflow_dispatch` deploy or
  Vercel's git-integration `deployment_status` success event — and on any failed check
  (`scripts/deploy-smoke.mjs`: 200 poll, server-rendered NodeBook HTML signal from
  `src/app/layout.tsx` metadata, `/api/notifications` 401 probe) runs
  `vercel rollback` and fails red. This is `rollbackMode: "automatic"`, but it guards
  a smoke-checked FULL deploy: a failing deploy serves 100% of traffic for the
  minutes between alias flip and rollback. It is not gradual exposure.
- **Cookie-sticky traffic split (exists, default off).** `src/middleware.ts` +
  `src/lib/canary.ts` rewrite a sticky slice of traffic to a second deployment when
  `CANARY_DEPLOYMENT_URL` and `CANARY_PERCENT` are set. `trafficPercent: 50` in the
  contract is the hard cap enforced in code, not a standing split — the default is 0
  (off), and turning it on is a manual per-release act. Rollback of the split itself
  is unsetting the env vars (manual); the automatic rollback above applies to the
  aliased deploy, not the split.
- **Caveat:** both deployments share one Convex production backend, so the split
  canaries the frontend only. A release that changes Convex functions or schema is
  not protected by the split — it hits 100% of backend traffic immediately; the
  cutover runbook in `doc/PRODUCTION_CUTOVER.md` still governs those.
- The deploy workflow's smoke checks require the `VERCEL_TOKEN` (plus
  `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`) repo secrets to roll back; without them the
  workflow still fails loudly but rollback is manual. The production alias defaults
  to `https://nodebook-rho.vercel.app` (documented in
  `docs/NODEAGENT_COMPLETION_AUDIT.md`) and is overridable via the
  `production_url` dispatch input or a `PRODUCTION_URL` repo variable.

## 2. Judge is rule-based, not LLM

Both judges are deterministic rule scorers: `scoreParityResult`
(convex/modelRouting.ts) and `scoreLiveEval` (src/app/api/query/evals/liveEval.ts).
There is no LLM-as-judge anywhere in the release path. `release.judgeRegression`
declares the rule-based suites that run in CI; do not read it as LLM judging.

## Validation

`node scripts/validate-production-agent.mjs` — compiles the copied
`production-agent.v1.schema.json` with the repo's ajv (v6, draft-07 engine; the
schema's keywords are draft-07 compatible, `$schema` is stripped at compile time) and
prints every error. Expected output: `VALID` with zero errors (the former
`/release` canary error is closed by gap 1's declared mechanisms).
