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
    OPENAI_API_KEY: z.string().optional(),
    EXTRACT_ENTITIES_OPENAI_MODEL: z.string().optional(),
    EXTRACT_ENTITIES_OPENAI_TEMP: z.string().optional(),
    PINECONE_API_KEY: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
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
  NEON_DB_ARIZ_REPLICA_MEW_LITE: process.env.NEON_DB_ARIZ_REPLICA_MEW_LITE || "",
  POSTGRES_DATABASE: process.env.POSTGRES_DATABASE || "",
  AUTH0_DOMAIN: process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "",
  AUTH0_API_AUDIENCE: process.env.NEXT_PUBLIC_AUTH0_API_AUDIENCE ?? "",
  AUTH0_JWT_PUBLIC_KEY: process.env.AUTH0_JWT_PUBLIC_KEY ?? "",
  PUSHER_APP_ID: process.env.PUSHER_APP_ID ?? "",
  PUSHER_KEY: process.env.PUSHER_KEY ?? "",
  PUSHER_SECRET: process.env.PUSHER_SECRET ?? "",
  PUSHER_CLUSTER: process.env.PUSHER_CLUSTER ?? "",
  PUSHER_CHANNEL_PREFIX: process.env.NEXT_PUBLIC_PUSHER_CHANNEL_PREFIX ?? "",
  NEXT_PUBLIC_HARDCODED_USER_ID: process.env.NEXT_PUBLIC_HARDCODED_USER_ID ?? "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  EXTRACT_ENTITIES_OPENAI_MODEL: process.env.EXTRACT_ENTITIES_OPENAI_MODEL ?? "",
  EXTRACT_ENTITIES_OPENAI_TEMP:
    process.env.EXTRACT_ENTITIES_OPENAI_TEMP && !isNaN(parseFloat(process.env.EXTRACT_ENTITIES_OPENAI_TEMP))
      ? parseFloat(process.env.EXTRACT_ENTITIES_OPENAI_TEMP)
      : null,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY ?? "",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
});
