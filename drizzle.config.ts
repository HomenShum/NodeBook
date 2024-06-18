import type { Config } from "drizzle-kit";

import { env } from "./src/envBackend";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: env.POSTGRES_CONNECTION_STRING,
  },
} satisfies Config;
