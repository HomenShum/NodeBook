# NodeBook repository guide

## Commands

- `yarn dev`, `yarn build`, `yarn start`
- `yarn lint`, `yarn typecheck`, `yarn test`, `yarn ci-tests`
- `yarn convex:dev`, `yarn convex:deploy`, `yarn convex:codegen`
- `yarn convex:import -- <export.json> <receipt.json>`

## Architecture

NodeBook is a node-native notebook built with Next.js, TypeScript, MobX, Lexical, Auth0, and Convex.

- `src/app/graph`: client graph model, optimistic updates, undo/redo, and sync queue.
- `src/app/editor`: Lexical editor and entity-aware plugins.
- `src/app/persistence`: graph serialization and bounded Convex snapshot loading.
- `src/app/api`: authenticated application wrappers for AI and external services.
- `convex`: authoritative schema, transactional mutations, reactive queries, and migration intake.

The browser consumes the existing serialized graph contract rather than Convex documents. Convex
functions enforce identity ownership, batch and response bounds, transaction idempotency, and
optimistic version checks.

## Required production invariants

- Auth0 subject is the owner boundary.
- No unauthenticated mutation path.
- No unbounded read, queue, batch, request, response, or retry loop.
- Sync errors return non-2xx status.
- Transaction identifiers are idempotent and reject divergent replay.
- Migration batches are content-addressed and emit a count-and-digest receipt.
- The original notebook interaction surface is preserved unless a change has matched visual proof.
