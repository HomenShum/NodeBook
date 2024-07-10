import { loadEnvConfig } from "@next/env";
import { z } from "zod";
loadEnvConfig(process.cwd());

const processEnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    POSTGRES_URL: z.string().optional(),
    POSTGRES_CUSTOM_URL: z.string().optional(),
  })
  .refine((data) => data.POSTGRES_CUSTOM_URL || data.POSTGRES_URL, "POSTGRES_URL or POSTGRES_CUSTOM_URL is required");
processEnvSchema.parse(process.env);
declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof processEnvSchema> {}
  }
}

export const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV,
  POSTGRES_CONNECTION_STRING:
    process.env.POSTGRES_CONNECTION_STRING || process.env.POSTGRES_CUSTOM_URL || process.env.POSTGRES_URL || "",
  PUSHER_APP_ID: process.env.PUSHER_APP_ID ?? "",
  PUSHER_KEY: process.env.PUSHER_KEY ?? "",
  PUSHER_SECRET: process.env.PUSHER_SECRET ?? "",
  PUSHER_CLUSTER: process.env.PUSHER_CLUSTER ?? "",
});
