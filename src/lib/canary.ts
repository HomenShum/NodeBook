// Cookie-sticky canary split, consumed by src/middleware.ts.
// Off unless CANARY_DEPLOYMENT_URL is set and CANARY_PERCENT parses > 0; hard-capped at 50.

export const CANARY_COOKIE = "nb-canary";
export const CANARY_PERCENT_CAP = 50;

export function canaryPercent(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, CANARY_PERCENT_CAP);
}

export function canaryDecision(
  cookieValue: string | undefined,
  percent: number,
  random: () => number = Math.random,
): "canary" | "stable" {
  if (percent <= 0) return "stable";
  if (cookieValue === "1") return "canary";
  if (cookieValue === "0") return "stable";
  return random() * 100 < percent ? "canary" : "stable";
}
