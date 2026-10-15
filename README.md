# NodeBook

NodeBook is a notebook for writing connected notes, browsing them as a graph, and
asking NodeAgent to research or organize them. It uses Next.js, MobX, Lexical,
Auth0, and Convex.

## Find your starting point

| Your task | Start here |
| --- | --- |
| Run a local development instance | [Local setup](#local-setup) |
| Understand the graph, editor, persistence and API boundaries | [Repository guide](CLAUDE.md#architecture) |
| Change notebook nodes or the rich-text editor | [Graph source](src/app/graph/) and [editor source](src/app/editor/) |
| Change NodeAgent research, proposals, receipts or Undo | [Query engine](src/app/api/query/), [notebook tools](src/app/query/notebookTools.ts) and [legacy behavior inventory](docs/NODEAGENT_LEGACY_PARITY_INVENTORY.md) |
| Change a visible or interactive surface | [Visual change contract](docs/FABLE_VISUAL_CHANGE_CONTRACT.md) |
| Check recorded production evidence | [2026-08-02 audit](docs/NODEAGENT_COMPLETION_AUDIT.md) |

The audit describes that dated deployment; it does not verify today's checkout.
For a handoff, record your commit, the commands you ran, the results and any
unverified behavior. Use the [verification commands](#verification) and
[production checklist](#production-deployment) for the revision you intend to use.
Surface changes are recorded in [the changelog](CHANGELOG/README.md).

## Local setup

Requirements:

- Node.js 22
- Yarn 4
- A Convex development deployment
- An Auth0 SPA and API configured for the same issuer and audience as Convex

Install and configure:

```bash
yarn install
yarn convex:dev
```

Set these values in `.env.local`:

```text
CONVEX_URL=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_AUTH0_DOMAIN=
NEXT_PUBLIC_AUTH0_CLIENT_ID=
NEXT_PUBLIC_AUTH0_API_AUDIENCE=
NEXT_PUBLIC_IS_AUTH_ENABLED=true
NEXT_PUBLIC_PERSISTENCE_ENABLED=true
NEXT_PUBLIC_USE_MOCK_USER_IF_AUTH_DISABLED=false
```

Set `AUTH0_DOMAIN` and `AUTH0_APPLICATION_ID` in the Convex deployment environment.

Start the application:

```bash
yarn dev
```

## Verification

```bash
yarn typecheck
yarn lint
yarn test
yarn test:convex
yarn build
```

## Production deployment

1. Deploy Convex functions with `yarn convex:deploy`.
2. Configure Auth0 and deployment environment values.
3. Run the migration importer against a signed export.
4. Verify source and destination counts and deterministic digests.
5. Run authenticated browser, concurrency, degraded-provider, and sustained-load scenarios.
6. Deploy the exact verified application commit.
7. Fetch the production HTML and authenticated application routes before declaring the release complete.
