import type { Config } from "drizzle-kit";

import { env } from "@/envBackend";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.POSTGRES_CONNECTION_STRING,
  },
} satisfies Config;
