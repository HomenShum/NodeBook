import { z } from "zod";

const processEnvSchema = z.object({
  NEXT_PUBLIC_PERSIST_TO: z.union([z.literal("local"), z.literal("server")]).optional(),
  NEXT_PUBLIC_PERSISTENCE_ENABLED: z.union([z.literal("true"), z.literal("false")]).optional(),
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().optional(),
  ENV: z.union([z.literal("development"), z.literal("production")]).optional(),
});
processEnvSchema.parse(process.env);
declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof processEnvSchema> {}
  }
}

export const env: {
  persistTo: "local" | "server";
  isPersistenceEnabled: boolean;
  isFrontend: boolean;
  pusherKey: string;
  pusherCluster: string;
  env: "development" | "production";
} = Object.freeze({
  persistTo: process.env.NEXT_PUBLIC_PERSIST_TO || "server",
  isPersistenceEnabled: process.env.NEXT_PUBLIC_PERSISTENCE_ENABLED === "true",
  isFrontend: typeof window !== "undefined",
  pusherKey: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
  pusherCluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "",
  env: process.env.ENV || "development",
});
