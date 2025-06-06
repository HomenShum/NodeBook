"use client";
import { Auth0Provider } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";

import { env } from "@/app/envFrontend";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();

  if (!env.isAuthEnabled) {
    return children;
  }

  if (!env.auth0Domain || !env.auth0ClientId) {
    throw new Error("Auth0 domain and client ID must be set in .env.local");
  }

  return (
    <Auth0Provider
      domain={env.auth0Domain}
      clientId={env.auth0ClientId}
      useRefreshTokens
      onRedirectCallback={(s) => router.replace(s?.returnTo ?? "/")}
      cacheLocation="localstorage"
      authorizationParams={{
        redirect_uri: global?.window?.location.origin,
        audience: env.auth0ApiAudience,
        issuer: env.auth0Domain,
        scope: "openid profile email offline_access",
      }}
    >
      {children}
    </Auth0Provider>
  );
};
