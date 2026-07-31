import { AuthConfig } from "convex/server";

const issuer = process.env.AUTH0_DOMAIN!;

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: process.env.AUTH0_APPLICATION_ID!,
      issuer,
      jwks: `${issuer}.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
