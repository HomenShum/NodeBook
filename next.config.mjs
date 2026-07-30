import { execSync } from "child_process";

import { withSentryConfig } from "@sentry/nextjs";

const gitCommitHash = execSync("git rev-parse --short HEAD").toString().trim();

/** @type {import('next').NextConfig} */
let nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma","@opentelemetry"]
  },
  env: {
    NEXT_PUBLIC_GIT_COMMIT_SHA: gitCommitHash,
  },
};

/**
 * This function assigns the build id to the current commit sha and injects it
 * into the client.
 *
 * It's important that the value returned by `generateBuildId` function and the
 * `NEXT_PUBLIC_BUILD_ID` are the same.
 *
 * Nextjs uses the build id from `generateBuildId` to determine if a new build
 * is available.
 *
 * We want our client to be able to determine that a build is new too.
 * Presumably nextjs is also injecting the build id created by `generateBuildId`
 * into the client (how else would the client know it's stale?), but I can't
 * find any docs on how to access it, so I assume you can't. Instead, we inject
 * the build id into the client ourselves.
 *
 * This keeps the server and client on the same content-addressed build identity.
 */
function withBuildId(nextConfig) {
  return {
    ...nextConfig,
    env: {
      ...nextConfig.env,
      NEXT_PUBLIC_BUILD_ID: gitCommitHash,
    },
    generateBuildId: async () => {
      return gitCommitHash;
    },
  };
}
nextConfig = withBuildId(nextConfig);

const sentryConfig = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
};

if (process.env.SENTRY_ENABLED === "true") {
  console.log("Sentry enabled");
  nextConfig = withSentryConfig(nextConfig, sentryConfig);
}

export default nextConfig;
