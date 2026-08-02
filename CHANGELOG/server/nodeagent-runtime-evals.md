# NodeAgent runtime evaluations

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
