import { captureMessage } from "@sentry/nextjs";

import { env } from "@/envBackend";

// Util function helps make eslint happy
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function fetchFromOpenAi(endpoint: string, body: FormData | string, maxRetries = 5) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
  };
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const baseDelayMs = 500;
  let retryDelayMs = baseDelayMs;
  let retries = 0;
  while (retries <= maxRetries) {
    const response = await fetch(endpoint, {
      method: "POST",
      body: body,
      headers: headers,
    });

    // Retry w/ exponential backoff when we receive rate limit errors
    if (response.status === 429) {
      captureMessage("OpenAI response code 429", { extra: { response } });
      if (retries >= maxRetries) {
        throw new Error("OpenAI rate limit error with no retries left, abandoning the request");
      }
      await delay(retryDelayMs);
      retryDelayMs *= 2;
      retries += 1;
      continue;
    }

    // Retry w/ linear backoff when we receive server errors
    if (response.status >= 500) {
      captureMessage(`OpenAI server error ${response.status}`, { extra: { response } });
      if (retries >= maxRetries) {
        throw new Error("OpenAI server error with no retries left, abandoning the request");
      }
      await delay(baseDelayMs);
      retries += 1;
      continue;
    }

    return await response.json();
  }
}
