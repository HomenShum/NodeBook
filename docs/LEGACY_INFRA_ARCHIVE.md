# Legacy infrastructure archive

NodeBook production uses Auth0, Convex, and Vercel. The previous PostgreSQL backup, migration, restore, EC2 deployment, branch-copy, and Pinecone-index workflows were removed after the Convex source/destination counts and digests were reconciled.

Rollback provenance remains recoverable from Git history and the private, gitignored migration receipts. `scripts/export-legacy-postgres.mjs` remains intentionally available as a read-only recovery utility and requires the immutable source user-table identifier through `LEGACY_USER_TABLE`.

No retired workflow, database credential, object-storage bucket, container registry, Redis endpoint, or Pinecone job is part of the production build.
