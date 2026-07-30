import { loadEnvConfig } from "@next/env";
import { z } from "zod";
loadEnvConfig(process.cwd());

const processEnvSchema = z
  .object({
    CONVEX_URL: z.string().url().optional(),
    AUTH0_DOMAIN: z.string().optional(),
    AUTH0_API_AUDIENCE: z.string().optional(),
    VERCEL_ENV: z
      .union([z.literal("development"), z.literal("preview"), z.literal("production")])
      .default("production"),
    NEXT_PUBLIC_HARDCODED_USER_ID: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    AGENT_MODEL: z.string().optional(),
    EXTRACT_ENTITIES_OPENAI_MODEL: z.string().optional(),
    EXTRACT_ENTITIES_OPENAI_TEMP: z.string().optional(),
    PINECONE_API_KEY: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    SKIP_PERSISTENCE_REQUIREMENT: z.string().optional(),
  })
  .refine(
    (data) =>
      data.CONVEX_URL ||
      data.SKIP_PERSISTENCE_REQUIREMENT === "true",
    "CONVEX_URL is required",
  );
processEnvSchema.parse(process.env);
declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof processEnvSchema> {}
  }
}

export const env = Object.freeze({
  STAGE: process.env.VERCEL_ENV,
  CONVEX_URL: process.env.CONVEX_URL || "",
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN ?? "",
  AUTH0_API_AUDIENCE: process.env.AUTH0_API_AUDIENCE ?? "",
  NEXT_PUBLIC_HARDCODED_USER_ID: process.env.NEXT_PUBLIC_HARDCODED_USER_ID ?? "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  AGENT_MODEL: process.env.AGENT_MODEL || "gpt-5-mini",
  EXTRACT_ENTITIES_OPENAI_MODEL: process.env.EXTRACT_ENTITIES_OPENAI_MODEL ?? "",
  EXTRACT_ENTITIES_OPENAI_TEMP:
    process.env.EXTRACT_ENTITIES_OPENAI_TEMP && !isNaN(parseFloat(process.env.EXTRACT_ENTITIES_OPENAI_TEMP))
      ? parseFloat(process.env.EXTRACT_ENTITIES_OPENAI_TEMP)
      : null,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY ?? "",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
});
