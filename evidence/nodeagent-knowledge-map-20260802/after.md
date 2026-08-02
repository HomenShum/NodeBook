# NodeAgent knowledge-map production proof

Date: 2026-08-02
Production: `https://nodebook-rho.vercel.app`
Viewport: 2560 × 1431, DPR 1

## Observed contract

- Signed owner session; exact root notebook.
- Agent + Auto mode with one-time OpenAI context egress approval.
- Tool order: `find_nodes → semantic_retrieval → find_related_nodes_via_graph → create_knowledge_map → finish_investigation → synthesize_from_notebook → validate_proposal → finish_work`.
- 12 exact notebook evidence nodes, 2 deterministic clusters, 15 typed operations, 0 web sources.
- Fresh production receipt reached `Checkpoint: applied` / `Status: applied` with durable receipt and visible Undo.
- Hard reload preserved the applied receipt.
- Undo reached `Checkpoint: undone` / `Status: undone` without an application error.
- Final hard reload preserved the undone receipt and showed zero Knowledge Map rows.
- Production data audit after recovery: zero failed-run orphan nodes, zero orphan relations, zero remaining Knowledge Map containers.

## Reliability defects closed by live proof

- Canonical source-binding digest now ignores ephemeral retrieval signals but detects real note changes.
- Durable graph work waits for `/api/sync`; a 409 cannot be reported as applied.
- Rollback retries skip already-restored entities, reconstruct only required legacy scaffolds, and fail closed on genuine concurrent edits.
- Specialized `semantic_cluster` evidence survives deduplication and is prioritized before general retrieval within existing bounds.
- Relation endpoint moves advance their version exactly once.
- Same-version derived updates preserve authoritative migrated fields such as `slug`; endpoint updates preserve authoritative creation metadata.
- Sync failures expose a bounded typed conflict code without graph content.

## Visual artifacts

- `fresh-auto-applied.png`
- `fresh-auto-undone.png`
- `fresh-auto-undone-reloaded-clean.png`
- `legacy-partial-undo-complete.png`
- `legacy-partial-undo-reloaded.png`

Graph visualization remains implemented with `@xyflow/react` 12.11.2. No custom SVG graph renderer was introduced.
