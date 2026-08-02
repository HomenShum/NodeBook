# NodeAgent runtime evaluations

## 2026-08-02 — Persist model execution failures as benchmark evidence
After provider execution begins, convert malformed structured output, checkpoint validation failure, or provider execution failure into an HTTP 422 durable `execution_failed` receipt with the observed model, bounded reason, accumulated usage when known, and zero graph mutation. Preflight and persistence failures remain non-durable errors.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/db/agent-runtime-evaluations.md`, `CHANGELOG/components/nodeagent-runtime-verification.md`

## 2026-08-02 — Restore and run durable suites from the NodeAgent sidebar
Expose an authenticated history read and bounded suite identifiers so owners can trigger the locked cases through normal product controls, stop after the current durable receipt, recover after provider failure, and restore the newest suite after reload without creating a second agent engine.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/components/nodeagent-runtime-verification.md`, `CHANGELOG/db/agent-runtime-evaluations.md`

## 2026-08-02 — Fail malformed evaluation requests closed
Return an honest 400 for malformed JSON before any provider work instead of collapsing client errors into a provider-style 502.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/db/agent-runtime-evaluations.md`

## 2026-08-02 — Run locked parity cases through the production engine
Add a consent-gated, authenticated, one-case-per-request endpoint that exercises the sole NodeAgent planner, validator, risk, source-binding, and digest pipeline without applying synthetic graph operations.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/db/agent-runtime-evaluations.md`, `CHANGELOG/agent/nodeagent-provider-runtime.md`

```text
BACKEND /api/query/evals
  -> AGENT executeWorkflowAgent + bounded provider
  -> DATABASE agentRuntimeEvaluations (owner-scoped, max 100)
```
