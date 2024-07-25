import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/envBackend";

const JWT_PUBLIC_KEY = Buffer.from(env.JWT_PUBLIC_KEY, "base64").toString("utf-8").trim();

function verifyToken(token: string) {
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

export function withAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ status: "error", message: "Missing authorization header" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    try {
      await verifyToken(token);
    } catch (error) {
      return NextResponse.json(
        { status: "error", message: "Invalid or expired token", error, env, JWT_PUBLIC_KEY, token },
        { status: 401 },
      );
    }

    return handler(req);
  };
}
