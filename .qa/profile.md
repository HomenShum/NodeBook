# QA profile: NodeBook production replacement

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
| What does the agent do? | Ask is read-only. Agent and Organization create durable, reviewable proposals; only the authenticated owner can explicitly accept and apply them. |
| Where is consent shown? | Query preflight immediately below the notebook query field |
| Where is the receipt shown? | Response receipt with run ID, proposal/application status, evidence-node and web-source counts, and durable-store state |
| LIVE signal | `data-testid="agent-receipt"`, visible `agent-steps`, non-placeholder response, durable proposal, explicit accept/apply, reload persistence, and undo |
| DEGRADED signal | Receipt explicitly says it was not durably stored, or route returns an honest non-2xx failure |
| FAILED signal | `Run not completed`; no answer or graph mutation is shown |

## Journey mapping

- A0 Smoke: open production; original node notebook shell renders; no Mew/Ideaflow product copy; no console crash.
- A1 Core notebook: authenticate, create and edit nested notes, reload, verify Convex persistence and original notebook interactions.
- A2 Live agent: run Ask, Agent, and Organization; inspect egress preflight; verify visible tool trace and `finish_work`; accept one proposal and reject another.
- A3 Provenance: match response receipt to the authenticated owner's run/proposal/step ledgers; verify model, status, source bindings, web sources, and honest token values.
- A4 Output: exercise notebook import/export where available and verify round-trip identity/counts.
- A5 Access: desktop 1440x900, tablet 768x1024, mobile 390x844; keyboard focus, light/dark, no horizontal overflow.
- A6 Adversarial: no consent, missing/malformed token, prompt injection in a note, stale proposal binding, malformed JSON, duplicate run ID, provider failure, Convex receipt failure, oversized provider response.
- A7 Depth: burst and sustained run/proposal/step ledgers remain bounded; concurrent graph edits surface conflicts; partial apply rolls back; undo survives reload; failed runs preserve canonical graph state.

## App-specific traps

- This profile is for the real, original notebook UI now branded NodeBook, not the separate deterministic NodeKit-generated demo.
- Do not describe a run as live from labels alone; require a rendered response plus durable receipt and server-side ledger evidence.
- Do not claim the migration complete until source/destination counts and digests are reconciled, or explicitly mark legacy data unavailable.
- The Auth0 trial banner is not a product failure, but plan status must be resolved before the trial expires.
