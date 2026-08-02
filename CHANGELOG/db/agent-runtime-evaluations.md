# agentRuntimeEvaluations

## 2026-08-02 — Reject duplicate source bindings
Fail closed when an evaluation receipt repeats a source ID, preserving exact deterministic provenance rather than storing ambiguous citation state.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/server/nodeagent-runtime-evals.md`

## 2026-08-02 — Persist bounded owner-scoped evaluation receipts
Store honest pass/fail, model, latency, usage, tool order, operation shape, citations, and proposal digest for live parity runs; reject malformed or oversized receipts and evict history beyond 100 per owner.
**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/server/nodeagent-runtime-evals.md`, `CHANGELOG/agent/nodeagent-provider-runtime.md`
