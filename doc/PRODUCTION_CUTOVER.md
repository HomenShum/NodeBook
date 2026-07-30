# NodeBook production cutover

This is the operator runbook for replacing the legacy persistence runtime without replacing the original notebook UI.

## Preconditions

- Freeze writes on the legacy production application.
- Export `users`, `nodes`, `relations`, `relationTypes`, and `relationLists` into the importer's JSON contract.
- Record the source export's immutable object-store URL, SHA-256 digest, row counts, and timestamp.
- Create separate Convex preview and production deployments.
- Configure Auth0 so the SPA, API audience, and Convex JWT issuer use the same production tenant.
- Generate a random, one-time `MIGRATION_SECRET`; never commit it.
- Preserve the previous deployment and database as read-only rollback targets.

## Preview rehearsal

1. Set the values documented in `.env.example` for the preview environment.
2. Deploy the Convex schema and functions:

   ```bash
   yarn convex:deploy
   yarn convex:codegen
   ```

3. Import the frozen export:

   ```bash
   CONVEX_SITE_URL=https://preview-deployment.convex.site \
   MIGRATION_SECRET=... \
   SOURCE_NAMESPACE=legacy-namespace \
   TARGET_NAMESPACE=nodebook \
   yarn convex:import ./source-export.json ./preview-receipt.json
   ```

4. Require every receipt table to satisfy `sourceCount === importedCount`.
5. Replay the identical import and require every batch to report `replayed: true`.
6. Attempt a changed payload with a reused batch key and require a non-2xx conflict.
7. Run authenticated owner/private-sharing, two-tab conflict, public-sharing, offline/retry, oversized-payload, and sustained-edit scenarios.
8. Verify the original notebook interactions and NodeBook identity at desktop and mobile viewports.

## Production activation

1. Announce the write freeze and record its exact start time.
2. Take the final immutable export and record its digest/count manifest.
3. Deploy the exact Convex functions and application commit that passed preview.
4. Import the final export and retain the generated receipt.
5. Compare source counts and deterministic digests with the receipt; any mismatch is a stop condition.
6. Run authenticated smoke tests for login, initial snapshot, edit/sync, reload, two-tab conflict, search, slug routing, notifications, and public sharing.
7. Point production traffic to NodeBook only after every smoke test passes.
8. Fetch the production URL and verify a concrete NodeBook DOM signal in raw HTML; verify authenticated browser state separately.
9. Disable and rotate `MIGRATION_SECRET`.
10. Keep the legacy application and database read-only through the rollback window.

## Rollback triggers

Rollback immediately if any of these occur:

- receipt count or digest mismatch;
- authentication issuer/audience failure;
- private data visible to a different owner;
- lost or silently acknowledged writes;
- sustained sync error rate above the agreed SLO;
- original notebook editing flow unavailable.

Rollback means routing traffic to the preserved previous deployment, leaving the legacy database read-only except for the explicitly approved recovery procedure, and retaining the Convex deployment and receipts for diagnosis. Do not reverse-import partially written Convex data into the legacy database.

## Release evidence

Archive the application commit, Convex deployment identifier, Auth0 configuration export, source manifest, migration receipt, scenario-test output, before/after screenshots, production raw-HTML signal, and rollback decision owner in the release record.
