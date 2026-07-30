# NodeBook

NodeBook is a node-native notebook built with Next.js, MobX, Lexical, Auth0, and Convex.

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
