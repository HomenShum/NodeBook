# Mew

## Getting Started

### Prerequisites

- [Node.js v22.14.0](https://nodejs.org/en/download)
- [Yarn](https://yarnpkg.com/getting-started/install)

### Install

(Optional) Install recommended VSCode extensions:

- Open the extensions sidebar in VSCode
- Search for `@recommended`
- Install all listed extensions

Install dependencies:

```bash

yarn
```

Link the vercel project then pull our `.env` file from vercel:

```bash

yarn vercel:link
yarn vercel env pull --environment=development .env.local

```

By default, persistence is disabled. To enable persistence, set the `NEXT_PUBLIC_PERSISTENCE_ENABLED` environment variable to `true` and `NEXT_PUBLIC_IS_AUTH_ENABLED` to `true` in `.env.local`.

Moreover, you'll want to change `POSTGRES_CUSTOM_URL` in `.env.local` to point to `mew_lite` instead of `verceldb` to link your local app to our main development database (i.e. to work with the same backend as `edge.globalbrain.ai`). See below for how to set up your own development database.

### Start

Start the development server:

```bash
yarn dev
```

### (Recommended) Set up a database for testing

_Note: This is only necessary for changes that modify the existing database schema_

- Go to `mew-postgres` database in vercel: https://vercel.com/ideaflowco/mew/stores/integration/neon/store_lxFSgFAtApzk0tud/guides
- In the data tab, run `create database <db-name>` to create a new database for your local development
- Update the `POSTGRES_CUSTOM_URL` in `.env.local` with the new database name. For example, if the current url ends with `/development`, change it to `/<db-name>`
- Run `yarn db:migrate` to create the tables in the new database
- When you're done, you can delete the database by running `drop database <db-name>` in the [vercel data tab](https://vercel.com/ideaflowco/mew/stores/postgres/store_lxFSgFAtApzk0tud/data)

## App instances

Our application runs across multiple instances, each serving different purposes in our development pipeline. The diagram below illustrates how our branches map to different deployments and their corresponding databases. This setup allows us to maintain stable environments for development and testing while keeping historical snapshots of key past architectural transitions.

![App instances](./app-instance-layout.png)

## Migrate the database

- Update the schema in `src/db/schema.ts`
- Run `yarn db:generate-migration` to create a new migration file
  - If there are no schema changes, run `drizzle-kit generate:pg --custom` to create an empty migration file that you can put your SQL into.
- Apply the migration with `yarn db:migrate` (to the database specified in your .env file)
- Commit and push the schema change and the migration file

## Restoring database backups

Every 12 hours (12AM/12PM UTC) backups are stored in mew-vercel-backup (us-west-1).

Here are the steps to restore a backup:

1. Download the backup from s3: https://us-west-1.console.aws.amazon.com/s3/buckets/mew-vercel-backup
2. Clear the database and restore using `pg_restore -c -v --no-acl -d <database-connection-string> <path-to-backup>`
   - The `pg_restore` version must be 16 (Vercel currently uses 16).
   - Make sure `database-connection-string` ends with a database name.
   - Example: `pg_restore -c -v --no-acl -d postgres://user:pass@host:port/db_name /home/username/dump-2024-10-02-18-28.bak`
3. (Optional) If the tables aren't showing up, it may be that the search path wasn't restored correctly. You can set the search path manually by running `SET search_path TO "$user", public;`

The database should now be restored.

## VSCode Debugging

Assuming you are using vscode, its debugging feature is a great way to see how things happen under the hood. The `.vscode/launch.json` contains the config for launching google chrome against localhost.

To run the debugger, do the following:

- Install (if not already) Javascript Debugger
- Ensure that your local host is set to serve at the same host as the one in `.vscode/launch.json`
- Select your breakpoints
- Run `yarn dev` or whatever you use to launch the app
- Go to the “Run and Debug” tab in VSCode (`Ctrl-Shift-D` in Linux)
- Select the appropriate launch command in the dropdown at the top-left of the screen, and run.

