// Post-deploy smoke check for the production alias. Run by
// .github/workflows/deploy-production.yml; on failure the workflow runs `vercel rollback`.
//
// Checks, in order:
//   1. Poll PRODUCTION_URL until it answers HTTP 200 (alias propagation).
//   2. The raw HTML carries the server-rendered NodeBook signal from src/app/layout.tsx
//      metadata (title + description) — NOT client-hydrated content.
//   3. /api/notifications answers 401 to an unauthenticated GET (withAuth is executing;
//      a 404/5xx means the API layer did not deploy).
//
// Usage: PRODUCTION_URL=https://nodebook-rho.vercel.app node scripts/deploy-smoke.mjs

const productionUrl = (process.env.PRODUCTION_URL ?? "").replace(/\/+$/, "");
if (!/^https:\/\//.test(productionUrl)) {
  console.error("PRODUCTION_URL must be an https URL, got: " + JSON.stringify(productionUrl));
  process.exit(1);
}

const POLL_ATTEMPTS = Number(process.env.SMOKE_POLL_ATTEMPTS ?? 30);
const POLL_DELAY_MS = Number(process.env.SMOKE_POLL_DELAY_MS ?? 10_000);
const MAX_BODY_BYTES = 1_000_000;
// Server-rendered in the document head by src/app/layout.tsx metadata.
const HTML_SIGNALS = ["<title>NodeBook</title>", "A node-native notebook for thinking and collaboration"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function boundedFetch(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
    const body = (await response.text()).slice(0, MAX_BODY_BYTES);
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  // 1. Poll until the alias serves 200.
  let page;
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
    try {
      page = await boundedFetch(productionUrl + "/", { headers: { "user-agent": "nodebook-deploy-smoke" } });
      console.log(`poll ${attempt}/${POLL_ATTEMPTS}: HTTP ${page.status}`);
      if (page.status === 200) break;
    } catch (error) {
      console.log(`poll ${attempt}/${POLL_ATTEMPTS}: ${error.message}`);
      page = undefined;
    }
    if (attempt < POLL_ATTEMPTS) await sleep(POLL_DELAY_MS);
  }
  if (!page || page.status !== 200) {
    throw new Error(`production alias never answered 200 within ${POLL_ATTEMPTS} attempts`);
  }

  // 2. Server-rendered content signal in the raw HTML.
  const missing = HTML_SIGNALS.filter((signal) => !page.body.includes(signal));
  if (missing.length > 0) {
    throw new Error("raw HTML is missing server-rendered signal(s): " + JSON.stringify(missing));
  }
  console.log("HTML signals present: " + JSON.stringify(HTML_SIGNALS));

  // 3. API layer alive: unauthenticated request must be rejected by withAuth, not 404/5xx.
  const api = await boundedFetch(productionUrl + "/api/notifications");
  if (api.status !== 401) {
    throw new Error(`/api/notifications expected 401 for unauthenticated GET, got ${api.status}`);
  }
  console.log("/api/notifications answered 401 (API layer deployed and auth-gated)");

  console.log("SMOKE PASS " + productionUrl);
}

main().catch((error) => {
  console.error("SMOKE FAIL: " + error.message);
  process.exit(1);
});
