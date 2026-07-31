import { AuthConfig } from "convex/server";

const issuer = process.env.AUTH0_DOMAIN!;

export default {
  providers: [
    {
      domain: issuer.replace(/^https:\/\//, "").replace(/\/$/, ""),
      applicationID: process.env.AUTH0_CLIENT_ID!,
    },
    {
      type: "customJwt",
      applicationID: process.env.AUTH0_API_AUDIENCE!,
      issuer,
      jwks: `${issuer}.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
