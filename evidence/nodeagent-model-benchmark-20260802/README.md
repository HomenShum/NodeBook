# NodeAgent free-model certification — 2026-08-02

## Decision

No free model was promoted. Production remains on the configured OpenAI fallback because every candidate failed at least one of the six locked NodeAgent parity cases.

The production Convex route is `benchmarkStatus: failed`, `benchmarkVersion: nodeagent-notion-parity-v3`, with no fallback models. The signed NodeBook UI consequently reports `openai / gpt-5-mini` as the expected route.

## Catalog result

The production action `modelRouting:benchmarkFreeModels` evaluated the four newest compatible `:free` models returned by OpenRouter's catalog after requiring tools, structured outputs, and at least 32k context.

| Candidate | Complete cases | Criteria | Score | Dominant failure mode |
| --- | ---: | ---: | ---: | --- |
| `google/gemma-4-26b-a4b-it:free` | 0/6 | 13/23 | 56.5% | NodeAgent disposition, tool-order, and operation-kind mismatches |
| `nvidia/nemotron-3-super-120b-a12b:free` | 0/6 | 3/23 | 13.0% | Non-JSON reasoning text and malformed structured output |
| `nvidia/nemotron-nano-9b-v2:free` | 0/6 | 0/23 | 0% | Truncated or empty JSON |
| `openai/gpt-oss-20b:free` | 0/6 | 0/23 | 0% | Markdown/non-JSON output and parity mismatches |

## Benchmark correction

The first v2 run exposed an invalid 100-token certification cap that was smaller than the live NodeAgent planner's 400-token structured-output budget. Version v3 now uses the same 400-token budget and a bounded 20-second per-case timeout. The v3 rerun still produced no passing model, so the fail-closed result is behavioral rather than an artifact of the old token cap.

## Automatic rerun contract

- Hourly catalog refresh fingerprints the sorted candidate set and skips unchanged v3 results.
- A new compatible model or a benchmark-version change reruns certification.
- Three consecutive production model failures schedule a failure-threshold rerun after the one-hour cooldown.
- The reporting mutation atomically reserves `benchmarkStatus: running`; a 25-failure burst schedules exactly one benchmark, not 23 concurrent actions.
- Promotion requires all six cases to pass. Scores have no floor or manual override.

## Reproduction

```powershell
npx convex run modelRouting:benchmarkFreeModels --prod
npx convex run modelRouting:benchmarkState --prod
npx convex data agentModelEvaluations --prod --limit 10
yarn test:convex
```

Observed gates: 31 Convex production tests passed; TypeScript and TCM checks passed; the production Convex deployment completed schema validation without index deletion.
