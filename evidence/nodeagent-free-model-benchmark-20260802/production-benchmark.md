# NodeAgent production free-model benchmark

Observed: 2026-08-02

## Production route state

- Benchmark version: `nodeagent-notion-parity-v4`
- Last benchmark: 2026-08-02 10:34:16 UTC
- Status: `failed`
- Consecutive model-quality failures after signed planner-guard proof: 2
- Certified fallback models: none

Although the stored diagnostic row retains the last candidate model ID, `currentRoute` returns a route only when `benchmarkStatus` is `ready`, the benchmark version matches, and a primary model exists. The live status therefore fails closed to the configured OpenAI provider rather than routing user work to an uncertified free model.

## Latest free candidates observed

| Model | Complete cases | Criteria | Score |
|---|---:|---:|---:|
| `google/gemma-4-26b-a4b-it:free` | 0/6 | 14/24 | 58.3% |
| `nvidia/nemotron-nano-9b-v2:free` | 0/6 | 0/24 | 0% |
| `nvidia/nemotron-3-super-120b-a12b:free` | 0/6 | 0/24 | 0% |
| `openai/gpt-oss-20b:free` | 0/6 | 0/24 | 0% |

No candidate is promotable. Promotion remains strict: every locked workflow must pass.

## Automatic behavior

- An hourly Convex cron fingerprints the current free structured/tool-capable catalog and reruns only when the fingerprint or benchmark version changes.
- Three consecutive model-quality failures schedule one bounded rerun, subject to the cooldown and a single running benchmark.
- The planner repeat guard now treats rationale-only paraphrases as the same semantic tool call. Its failed deterministic checkpoint feeds the model-quality counter; unrelated semantic-retrieval degradation does not.

Two signed production runs deliberately reproduced the degraded planner loop while hardening its semantic identity. Both incremented the counter. A third real model-quality failure will schedule the bounded failure-triggered rerun; the test suite separately proves that a 25-failure burst schedules only one benchmark while it remains running.
