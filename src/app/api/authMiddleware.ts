import jwt, { JwtPayload } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

import { UNLOGGED_USER } from "@/app/auth/MewUser";
import { env } from "@/envBackend";

const JWT_PUBLIC_KEY = Buffer.from(env.AUTH0_JWT_PUBLIC_KEY, "base64").toString("utf-8").trim();

function verifyToken(token: string): Promise<string | JwtPayload | undefined> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      JWT_PUBLIC_KEY,
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
      req.userId = UNLOGGED_USER.id;
      return handler(req);
    }

    const token = authHeader.split(" ")[1];
    try {
      const payload = await verifyToken(token);

      if (!payload || typeof payload.sub !== "string") {
        return NextResponse.json({ status: "error", message: "Invalid user ID" }, { status: 400 });
      }

      req.userId = payload.sub;
    } catch (error) {
      return NextResponse.json({ status: "error", message: "Invalid or expired token" }, { status: 401 });
    }

    return handler(req);
  };
}
