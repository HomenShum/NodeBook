# Mew

## Getting Started

Prerequisites

- [Node.js](https://nodejs.org/en/download)
- [Yarn](https://yarnpkg.com/getting-started/install)

(Optional) Install recommended VSCode extensions:

- Open the extensions sidebar in VSCode
- Search for `@recommended`
- Install all listed extensions

Install dependencies:

```bash
yarn
```

Link the vercel project then pull the `.env` file from vercel:

```bash
yarn vercel:link
yarn vercel env pull --environment=development .env.local
```

(Optional) By default, persistence is disabled. To enable persistence, set the `NEXT_PUBLIC_PERSISTENCE_ENABLED` environment variable to `true` and `NEXT_PUBLIC_IS_AUTH_ENABLED` to `true` in `.env.local`.

Start the development server:

```bash
yarn dev
```

## Set up a database for testing

- Go to `mew-postgres` database in vercel: https://vercel.com/ideaflowco/mew/stores/postgres/store_lxFSgFAtApzk0tud/data
- In the data tab, run `create database <db-name>` to create a new database for your local development
- Update the `POSTGRES_CUSTOM_URL` in `.env.local` with the new database name. For example, if the current url ends with `/development`, change it to `/<db-name>`
- Run `yarn db:migrate` to create the tables in the new database
- When you're done, you can delete the database by running `drop database <db-name>` in the [vercel data tab](https://vercel.com/ideaflowco/mew/stores/postgres/store_lxFSgFAtApzk0tud/data)

## Migrate the database

- Update the schema in `src/db/schema.ts`
- Run `yarn db:generate-migration` to create a new migration file
  - If there are no schema changes, run `drizzle-kit generate:pg --custom` to create an empty migration file that you can put your SQL into. 
- Apply the migration with `yarn db:migrate` (to the database specified in your .env file)
- Commit and push the schema change and the migration file

## Restoring database backups
- Every 12 hours (12AM/12PM UTC) backups are stored in mew-vercel-backup (us-west-1).
- Download the backup and run `pg_restore -v -d <database-connection-string> <path-to-backup>`
  - Make sure `database-connection-string` ends with a database name.
  - Example: `pg_restore -v -d postgres://user:pass@host:port/db_name /home/username/dump-2024-10-02-18-28.bak`
- Please make sure your `pg_restore` version is 16 (Vercel currently uses 16).
- Please do not run `db:reset`, it will run migrations and hydrate the database, causing conflicts
  with the database. 
  - Drop the database before running `pg_restore` or run it with `--clean`/`-c` flags.
    - Example: `pg_restore -c -v -d <connectiom-string> <backup-path>`