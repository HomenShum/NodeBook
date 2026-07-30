import { captureException } from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NextAuthenticatedRequest, withAuth } from "@/app/api/authMiddleware";
import { env } from "@/envBackend";
import {
  getBearerToken,
  getConvexClient,
  recordAgentRunReference,
  searchNodesReference,
} from "@/lib/convexServer";

import { AgentUsage, executeReadOnlyAgent } from "./agent";

export const maxDuration = 30;
const OPENAI_TIMEOUT_MS = 20_000;
const MAX_OPENAI_RESPONSE_BYTES = 2 * 1024 * 1024;
const RequestSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  consent: z.literal(true),
});

async function readBoundedJson(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > MAX_OPENAI_RESPONSE_BYTES) throw new Error("AI provider response exceeded the size limit");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_OPENAI_RESPONSE_BYTES) {
    throw new Error("AI provider response exceeded the size limit");
  }
  return JSON.parse(text) as Record<string, any>;
}

async function runOpenAI(args: { query: string; context: string; model: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("AI provider timed out"), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: args.model,
        max_output_tokens: 800,
        instructions:
          "Answer only from the supplied NodeBook graph context. Distinguish direct evidence from inference. Say when the context is insufficient. Never claim to have modified the graph.",
        input: `QUESTION\n${args.query}\n\nNODEBOOK GRAPH CONTEXT\n${args.context || "(no matching nodes)"}`,
      }),
      signal: controller.signal,
    });
    const body = await readBoundedJson(response);
    if (!response.ok) throw new Error(`AI provider rejected the run (${response.status})`);
    const content =
      typeof body.output_text === "string"
        ? body.output_text
        : Array.isArray(body.output)
          ? body.output
              .flatMap((item: any) => (Array.isArray(item.content) ? item.content : []))
              .map((item: any) => (typeof item.text === "string" ? item.text : ""))
              .join("")
          : "";
    if (!content.trim()) throw new Error("AI provider returned an empty response");
    const usage: AgentUsage = {
      inputTokens: typeof body.usage?.input_tokens === "number" ? body.usage.input_tokens : null,
      outputTokens: typeof body.usage?.output_tokens === "number" ? body.usage.output_tokens : null,
      totalTokens: typeof body.usage?.total_tokens === "number" ? body.usage.total_tokens : null,
    };
    return { content, usage };
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withAuth(async (request: NextAuthenticatedRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const consentMissing = typeof body === "object" && body !== null && (body as any).consent !== true;
    return NextResponse.json(
      { error: consentMissing ? "Explicit consent is required for an AI run" : "Invalid query" },
      { status: consentMissing ? 403 : 400 },
    );
  }
  if (!env.OPENAI_API_KEY) return NextResponse.json({ error: "AI provider is not configured" }, { status: 503 });

  const convex = getConvexClient(getBearerToken(request));
  try {
    const result = await executeReadOnlyAgent(parsed.data.query, env.AGENT_MODEL, {
      searchContext: (query) => convex.query(searchNodesReference, { text: query, limit: 20 }),
      runProvider: runOpenAI,
      recordRun: (record) => convex.mutation(recordAgentRunReference, record),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("NodeBook agent run failed", error);
    captureException(error, { user: { id: request.userId } });
    return NextResponse.json({ error: "Agent run failed before completion" }, { status: 502 });
  }
});
