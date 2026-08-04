import { NextRequest, NextResponse } from "next/server";

import { CANARY_COOKIE, canaryDecision, canaryPercent } from "@/lib/canary";

// Plan-free traffic canary: when CANARY_DEPLOYMENT_URL and CANARY_PERCENT are set,
// rewrite a cookie-sticky slice of traffic (capped at 50%) to the canary deployment.
// Default off. Both deployments share the same Convex backend, so this splits the
// frontend only — see production-agent.gaps.md for the coupling caveat.
// ponytail: no matcher, so /_next/* assets are proxied through the rewrite too —
// that is required for correctness (asset hashes differ per deployment).
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("nodebook-url", request.url);

  const canaryUrl = process.env.CANARY_DEPLOYMENT_URL;
  const percent = canaryPercent(process.env.CANARY_PERCENT);
  if (canaryUrl && percent > 0) {
    const cookie = request.cookies.get(CANARY_COOKIE)?.value;
    const decision = canaryDecision(cookie, percent);
    const response =
      decision === "canary"
        ? NextResponse.rewrite(
            new URL(request.nextUrl.pathname + request.nextUrl.search, canaryUrl),
            { request: { headers: requestHeaders } },
          )
        : NextResponse.next({ request: { headers: requestHeaders } });
    if (cookie === undefined) {
      response.cookies.set(CANARY_COOKIE, decision === "canary" ? "1" : "0", { path: "/" });
    }
    return response;
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
