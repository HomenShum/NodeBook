import { createPublicKey, JsonWebKey as CryptoJsonWebKey } from "crypto";

import jwt, { JwtPayload } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

import { UNLOGGED_USER } from "@/app/auth/NodeBookUser";
import { env } from "@/envBackend";

const JWKS_TIMEOUT_MS = 5_000;
const JWKS_MAX_BYTES = 64 * 1024;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1_000;
const JWKS_CACHE_MAX_KEYS = 5;
const jwksCache = new Map<string, { key: string; expiresAt: number }>();

function auth0JwksUrl() {
  const domain = env.AUTH0_DOMAIN.trim().toLowerCase();
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com$/.test(domain)) {
    throw new Error("AUTH0_DOMAIN must be an Auth0-managed hostname");
  }
  return `https://${domain}/.well-known/jwks.json`;
}

async function readBoundedText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > JWKS_MAX_BYTES) {
        await reader.cancel();
        throw new Error("Auth0 JWKS exceeded the response cap");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function signingKey(kid: string) {
  const cached = jwksCache.get(kid);
  if (cached && cached.expiresAt > Date.now()) return cached.key;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Auth0 JWKS timed out"), JWKS_TIMEOUT_MS);
  try {
    const response = await fetch(auth0JwksUrl(), { signal: controller.signal });
    if (!response.ok) throw new Error(`Auth0 JWKS request failed (${response.status})`);
    const body = JSON.parse(await readBoundedText(response)) as {
      keys?: Array<{ kid?: string; kty?: string; use?: string; n?: string; e?: string }>;
    };
    const jwk = body.keys?.slice(0, JWKS_CACHE_MAX_KEYS).find((candidate) => candidate.kid === kid);
    if (!jwk || jwk.kty !== "RSA" || !jwk.n || !jwk.e) throw new Error("Token signing key was not found");
    const key = createPublicKey({ key: jwk as CryptoJsonWebKey, format: "jwk" }).export({
      type: "spki",
      format: "pem",
    });
    if (jwksCache.size >= JWKS_CACHE_MAX_KEYS) jwksCache.delete(jwksCache.keys().next().value as string);
    const pem = key.toString();
    jwksCache.set(kid, { key: pem, expiresAt: Date.now() + JWKS_CACHE_TTL_MS });
    return pem;
  } finally {
    clearTimeout(timeout);
  }
}

function verifyToken(token: string): Promise<string | JwtPayload | undefined> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      async (header, callback) => {
        if (header.alg !== "RS256" || !header.kid) return callback(new Error("Unsupported token signing header"));
        try {
          callback(null, await signingKey(header.kid));
        } catch (error) {
          callback(error instanceof Error ? error : new Error("Unable to resolve token signing key"));
        }
      },
      {
        audience: env.AUTH0_API_AUDIENCE,
        issuer: `https://${env.AUTH0_DOMAIN}/`,
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      },
    );
  });
}

export interface NextAuthenticatedRequest extends NextRequest {
  userId: string;
}

export function withAuth(handler: (req: NextAuthenticatedRequest) => Promise<NextResponse>) {
  return async (req: NextAuthenticatedRequest) => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      if (env.STAGE === "production") {
        return NextResponse.json({ status: "error", message: "Authentication required" }, { status: 401 });
      }
      req.userId = env.NEXT_PUBLIC_HARDCODED_USER_ID || UNLOGGED_USER.id;
      return handler(req);
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return NextResponse.json({ status: "error", message: "Invalid authorization header" }, { status: 401 });
    }
    try {
      const payload = await verifyToken(token);

      if (!payload || typeof payload.sub !== "string") {
        return NextResponse.json({ status: "error", message: "Invalid user ID" }, { status: 401 });
      }

      req.userId = payload.sub;
    } catch (error) {
      return NextResponse.json({ status: "error", message: "Invalid or expired token" }, { status: 401 });
    }

    return handler(req);
  };
}
