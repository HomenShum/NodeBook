# Real Mew → NodeBook in-place migration, slice 1

## Baseline

- Source: clean worktree from canonical Mew `origin/main`
- Viewport: 1440 × 900
- Route: `/g`
- Before title: `Tyler Durden - Zephyr`
- Before typecheck: exit 0
- Before graph scenarios: 2 suites, 8 tests passed

## After

- After title: `Tyler Durden - NodeBook`
- The visible notebook contract is unchanged: sidebar destinations, breadcrumbs, search, filters, sort,
  AI, expansion, list/display controls, pinned section, stream, templates, hashtags, favorites, and
  floating capture action are all present.
- Typecheck: exit 0
- Production build: exit 0
- Lint: exit 0 with ten pre-existing React hook warnings
- Matched graph scenarios: 2 suites, 8 tests passed

## Convex boundary added

- Auth0-bound user read/create/settings functions
- Auth0-bound graph snapshot pages
- Atomic graph sync mutation
- Transaction idempotency and payload-conflict detection
- Optimistic version conflict detection
- Bounded queue, batch, entity, page, and response sizes
- Client and server request timeouts
- HTTPS/localhost-only Convex URL validation
- PostgreSQL remains selectable as a rollback path

## Evidence

- `before.png`
- `after.png`
- `before-ui.json`
- `after-ui.json`
- `before-typecheck.txt`
- `after-typecheck.txt`
- `before-core-tests.txt`
- `after-core-tests.txt`
