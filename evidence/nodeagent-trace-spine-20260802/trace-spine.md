# NodeAgent trace-spine proof

Date: 2026-08-02

## Contract

Every new NodeAgent execution uses its existing `runId` as the canonical `traceId`. The same value is persisted on the owner-scoped run, every durable step, the checkpoint proposal, learned memory, and locked runtime-evaluation receipt. Agent and eval UI receipts expose that trace directly. Historical rows remain readable through a non-destructive `traceId ?? runId` fallback.

Convex rejects `traceId !== runId` with `TRACE_ID_RUN_ID_MISMATCH`, preventing one execution from being split across unrelated trace identities.

## Scenario evidence

- A production-shaped Ask run persisted the same trace on one run, two steps, and its learned memory while preserving the exact source binding.
- An adversarial mismatched trace failed closed before persistence.
- A failed locked runtime evaluation retained its exact trace rather than only an unrelated evaluation ID.
- Sustained 225-run memory retention remained bounded at 200 records.
- Sustained runtime-evaluation retention remained bounded at 100 records.

## Verification

- Jest: 51 suites, 262 tests passed.
- Convex production contracts: 44 tests passed.
- TypeScript typecheck passed.
- Targeted lint passed with zero warnings or errors.
- Next production build passed when the repository's intentionally redacted local placeholder variables were overridden in-process with syntactically valid validation-only values. Existing unrelated hook warnings remain unchanged.

This evidence certifies local code and scenario behavior. A production deployment and signed browser observation are still required before claiming the trace UI is live.
