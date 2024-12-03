import { z } from "zod";

const processEnvSchema = z.object({
  NEXT_PUBLIC_PERSIST_TO: z.union([z.literal("local"), z.literal("server")]).optional(),
  NEXT_PUBLIC_PERSISTENCE_ENABLED: z.union([z.literal("true"), z.literal("false")]).optional(),
  NEXT_PUBLIC_AUTH0_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_AUTH0_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_AUTH0_API_AUDIENCE: z.string().optional(),
  NEXT_PUBLIC_IS_AUTH_ENABLED: z.union([z.literal("true"), z.literal("false")]).optional(),
  NEXT_PUBLIC_USE_MOCK_USER_IF_AUTH_DISABLED: z.union([z.literal("true"), z.literal("false")]).optional(),
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().optional(),
  NEXT_PUBLIC_PUSHER_CHANNEL_PREFIX: z.string().optional(),
  NEXT_PUBLIC_GIT_COMMIT_SHA: z.string().optional(),
  NEXT_PUBLIC_BUILD_ID: z.string().optional(),
  NEXT_PUBLIC_LOG_SERVICE_INCLUDE: z.string().optional(),
  NEXT_PUBLIC_LOG_SERVICE_EXCLUDE: z.string().optional(),
  NEXT_PUBLIC_LOG_SERVICE_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  NEXT_PUBLIC_HARDCODED_USER_ID: z.string().optional(),
  NEXT_PUBLIC_ENV: z.union([z.literal("development"), z.literal("production"), z.literal("preview")]).optional(),
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
  auth0Domain: string | undefined;
  auth0ClientId: string | undefined;
  auth0ApiAudience: string | undefined;
  isAuthEnabled: boolean;
  useMockUserIfAuthDisabled: boolean;
  gitCommitSha: string | undefined;
  buildId: string | undefined;
  logServiceInclude: string[];
  logServiceExclude: string[];
  logServiceLevel: "debug" | "info" | "warn" | "error";
  hardcodedUserId: string | undefined;
  isFrontend: boolean;
  pusherKey: string;
  pusherCluster: string;
  pusherChannelPrefix: string;
  isMac: boolean;
  env: "development" | "production" | "preview";
} = Object.freeze({
  persistTo: process.env.NEXT_PUBLIC_PERSIST_TO || "server",
  isPersistenceEnabled: process.env.NEXT_PUBLIC_PERSISTENCE_ENABLED === "true",
  auth0Domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN || undefined,
  auth0ClientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || undefined,
  auth0ApiAudience: process.env.NEXT_PUBLIC_AUTH0_API_AUDIENCE || undefined,
  isAuthEnabled: process.env.NEXT_PUBLIC_IS_AUTH_ENABLED === "true",
  useMockUserIfAuthDisabled: process.env.NEXT_PUBLIC_USE_MOCK_USER_IF_AUTH_DISABLED === "true",
  gitCommitSha: process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || undefined,
  buildId: process.env.NEXT_PUBLIC_BUILD_ID || undefined,
  isFrontend: typeof window !== "undefined",
  logServiceInclude: process.env.NEXT_PUBLIC_LOG_SERVICE_INCLUDE?.split(",") || [],
  logServiceExclude: process.env.NEXT_PUBLIC_LOG_SERVICE_EXCLUDE?.split(",") || [],
  logServiceLevel: process.env.NEXT_PUBLIC_LOG_SERVICE_LEVEL || "debug",
  pusherKey: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
  pusherCluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "",
  pusherChannelPrefix: process.env.NEXT_PUBLIC_PUSHER_CHANNEL_PREFIX || "",
  env: process.env.NEXT_PUBLIC_ENV || "development",
  hardcodedUserId: process.env.NEXT_PUBLIC_HARDCODED_USER_ID || undefined,
  isMac:
    typeof navigator !== "undefined" &&
    (!!navigator.platform.match("Mac") || /Mac(Intel|PPC|ARM)/.test(navigator.userAgent)),
});
