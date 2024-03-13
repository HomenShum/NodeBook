import { z } from "zod";

const processEnvSchema = z.object({
  NEXT_PUBLIC_PERSISTENCE_ENABLED: z.union([z.literal("true"), z.literal("false")]).optional(),
  ENV: z.union([z.literal("development"), z.literal("production")]).optional(),
});
processEnvSchema.parse(process.env);
declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof processEnvSchema> {}
  }
}

export const env: {
  isPersistenceEnabled: boolean;
  isFrontend: boolean;
  env: "development" | "production";
} = Object.freeze({
  isPersistenceEnabled: process.env.NEXT_PUBLIC_PERSISTENCE_ENABLED === "true",
  isFrontend: typeof window !== "undefined",
  env: process.env.ENV || "development",
});
