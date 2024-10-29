import { loadEnvConfig } from "@next/env";
import { z } from "zod";
loadEnvConfig(process.cwd());

const processEnvSchema = z
  .object({
    POSTGRES_URL: z.string().optional(),
    POSTGRES_CUSTOM_URL: z.string().optional(),
    AUTH0_DOMAIN: z.string().optional(),
    AUTH0_API_AUDIENCE: z.string().optional(),
    AUTH0_JWT_PUBLIC_KEY: z.string().optional(),
    VERCEL_ENV: z.union([z.literal("development"), z.literal("preview"), z.literal("production")]),
    NEXT_PUBLIC_HARDCODED_USER_ID: z.string().optional(),
  })
  .refine((data) => data.POSTGRES_CUSTOM_URL || data.POSTGRES_URL, "POSTGRES_URL or POSTGRES_CUSTOM_URL is required");
processEnvSchema.parse(process.env);
declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof processEnvSchema> {}
  }
}

export const env = Object.freeze({
  STAGE: process.env.VERCEL_ENV,
  POSTGRES_CONNECTION_STRING:
    process.env.POSTGRES_CONNECTION_STRING || process.env.POSTGRES_CUSTOM_URL || process.env.POSTGRES_URL || "",
  AUTH0_DOMAIN: process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "",
  AUTH0_API_AUDIENCE: process.env.NEXT_PUBLIC_AUTH0_API_AUDIENCE ?? "",
  AUTH0_JWT_PUBLIC_KEY: process.env.AUTH0_JWT_PUBLIC_KEY ?? "",
  PUSHER_APP_ID: process.env.PUSHER_APP_ID ?? "",
  PUSHER_KEY: process.env.PUSHER_KEY ?? "",
  PUSHER_SECRET: process.env.PUSHER_SECRET ?? "",
  PUSHER_CLUSTER: process.env.PUSHER_CLUSTER ?? "",
  NEXT_PUBLIC_HARDCODED_USER_ID: process.env.NEXT_PUBLIC_HARDCODED_USER_ID ?? "",
});
