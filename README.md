# Mew

## Getting Started

Prerequisites

- [Node.js](https://nodejs.org/en/download)
- [Yarn](https://yarnpkg.com/getting-started/install)

Install dependencies:

```bash
yarn
```

Link the vercel project then pull the `.env` file from vercel:

```bash
yarn vercel:link
yarn vercel env pull --environment=development .env.local
```

(Optional) By default, persistence is enabled. To disable persistence, set the `NEXT_PUBLIC_PERSISTENCE_ENABLED` environment variable to `false` in `.env.local`.

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
- Apply the migration with `yarn db:migrate` (to the database specified in your .env file)
- Commit and push the schema change and the migration file
