"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";
import { useMemo } from "react";

import { env } from "@/app/envFrontend";

export function ConvexAuthProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(
    () => (env.convexUrl ? new ConvexReactClient(env.convexUrl) : null),
    [],
  );
  if (!client) throw new Error("NEXT_PUBLIC_CONVEX_URL is required when authentication is enabled");
  return <ConvexProviderWithAuth0 client={client}>{children}</ConvexProviderWithAuth0>;
}
