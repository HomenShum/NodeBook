# QA profile: NodeBook (Mew in-place migration)

## Environment

| Thing | Value |
|---|---|
| Production URL | `https://nodebook-rho.vercel.app` |
| Repo root | `D:\VSCode Projects\Ideaflow\nodebook-real` |
| Dev command + port | `npm run dev`; `http://127.0.0.1:3000` |
| Backend | Dedicated Convex project `nodebook`; separate development and production deployments |
| Auth | Auth0 SPA `NodeBook` and API audience `https://api.nodebook.app` |
| QA run mode | Authorized production dogfood; mutate only the QA user's NodeBook graph |
| Typecheck gate | `npm run typecheck` and `npx convex dev --once --typecheck=enable` |
| Test gate | Jest application scenarios, Vitest Convex scenarios, lint, production build |
| Evidence | `<repo>/evidence/nodebook-production-activation-<YYYYMMDD-HHmm>/` |
| Memory | `<repo>/.qa/memory/` |

## Provenance surface

| Question | Answer |
|---|---|
| What does the agent do? | Read-only graph-context question answering; it never writes graph entities |
| Where is consent shown? | Query preflight immediately below the notebook query field |
| Where is the receipt shown? | Response receipt with run ID, exact status, evidence-node count, token total, and durable-store state |
| LIVE signal | `data-testid="agent-receipt"`, provider/model preflight, non-placeholder response, completed receipt |
| DEGRADED signal | Receipt explicitly says it was not durably stored, or route returns an honest non-2xx failure |
| FAILED signal | `Run not completed`; no answer or graph mutation is shown |

## Journey mapping

- A0 Smoke: open production; original node notebook shell renders; no Mew/Ideaflow product copy; no console crash.
- A1 Core notebook: authenticate, create and edit nested notes, reload, verify Convex persistence and original notebook interactions.
- A2 Live agent: open query, inspect exact egress preflight, consent, submit one evidence-bound question, verify real response and completed durable receipt.
- A3 Provenance: match response receipt to the authenticated owner's `agentRuns` ledger; verify model, status, source IDs, and honest token values.
- A4 Output: exercise notebook import/export where available and verify round-trip identity/counts.
- A5 Access: desktop 1440x900, tablet 768x1024, mobile 390x844; keyboard focus, light/dark, no horizontal overflow.
- A6 Adversarial: no consent, missing token, malformed token, malformed JSON, duplicate run ID, provider failure, Convex receipt failure, oversized provider response.
- A7 Depth: burst and sustained receipt ledgers remain bounded; concurrent graph edits surface conflicts; failed runs preserve canonical graph state.

## App-specific traps

- This profile is for the real Mew notebook UI, not the separate deterministic NodeKit-generated NodeBook demo.
- Do not describe a run as live from labels alone; require a rendered response plus durable receipt and server-side ledger evidence.
- Do not claim the migration complete until source/destination counts and digests are reconciled, or explicitly mark legacy data unavailable.
- The Auth0 trial banner is not a product failure, but plan status must be resolved before the trial expires.
