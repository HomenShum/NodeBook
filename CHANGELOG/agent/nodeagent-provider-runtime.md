# NodeAgent provider runtime

## 2026-08-02 — Share the production provider across normal and evaluation runs
Extract the bounded Responses API adapter so normal NodeAgent requests and locked live evaluations use identical provider, timeout, structured-output, response-size, usage, and actual-model handling.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/server/nodeagent-runtime-evals.md`, `CHANGELOG/db/agent-runtime-evaluations.md`
