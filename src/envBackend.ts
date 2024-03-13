import { z } from "zod";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

export const processEnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    POSTGRES_URL: z.string().optional(),
    POSTGRES_CUSTOM_URL: z.string().optional(),
  })
  .refine(
    (data) => data.POSTGRES_CUSTOM_URL || data.POSTGRES_URL,
    "POSTGRES_URL or POSTGRES_CUSTOM_URL is required"
  );
processEnvSchema.parse(process.env);
declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof processEnvSchema> {}
  }
}

export const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV,
  POSTGRES_CONNECTION_STRING:
    process.env.POSTGRES_CONNECTION_STRING || process.env.POSTGRES_CUSTOM_URL || "",
});

console.log("Backend env variables:", env);
