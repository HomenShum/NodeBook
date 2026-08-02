# NodeAgent completed-step replay journal proof

Date: 2026-08-02

## Contract

An unchanged user retry reuses one UUID request identity and therefore one canonical trace. Each structured provider call receives a deterministic SHA-256 step key over its bounded semantic input. A durable pre-call Convex lease permits one simultaneous caller; later callers stop before the provider. A completed owner-scoped journal entry is replayed before any new provider call. Changed query, mode, execution mode, web-research setting, or notebook root produces a fresh request identity.

The first stored completion is canonical if simultaneous calls finish with different model output. A failed run can be promoted in place on retry after stale proposals, steps, and failure text are cleared. Reusing a trace for different query or mode fails with an honest 409 conflict.

## Bounds and failure behavior

- 512 KiB maximum serialized provider receipt.
- 100 completed provider steps maximum per trace.
- 500 newest provider steps maximum per owner, with deterministic oldest-first eviction.
- Owner-scoped journal reads prevent cross-notebook replay.
- Invalid digests, mismatched inputs, oversized responses, and invalid time/string fields fail closed.
- Provider timeouts and the existing 120-second route budget remain in force.
- Provider failures release their pending lease; abandoned leases expire within a bounded 120-second maximum.

## Scenario evidence

- An unchanged network retry replayed a completed response with zero calls to the mocked provider.
- Changed user intent generated a different request identity.
- Equivalent JSON schemas with different key order generated the same step key.
- A simulated simultaneous completion returned the first durable output as canonical.
- A simultaneous retry observed `in_progress` and made zero provider calls; after completion, the same claim replayed the durable response.
- A failed provider attempt released its lease and an immediate retry claimed it successfully.
- A failed trace retried into one completed run and exactly two durable steps without stale failure text.
- A second owner could not read the first owner's step.
- A 101st step on one trace failed closed.
- A 520-step sustained owner history retained exactly the newest 500 entries.

## Honest limitation

This prevents concurrent retries from duplicating a provider call and closes duplicate billing for every already-journaled completed step. It does not eliminate the narrow crash window between receiving a provider response and persisting that response to Convex. Provider-native idempotency or a durable workflow primitive is still required before describing the system as strictly exactly-once across process crashes.

## Verification

- Jest: 54 suites, 270 tests passed.
- Convex production contracts: 49 tests passed.
- TypeScript typecheck passed.

Production deployment and signed retry observation remain required before claiming the journal is live.
