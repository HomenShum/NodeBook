import { env } from "@/envBackend";

import { reasoningConfig } from "./providerConfig";
import { RESULT_JSON_SCHEMA, WorkflowUsage } from "./workflowAgent";

const MAX_OPENAI_RESPONSE_BYTES = 2 * 1024 * 1024;

async function readBoundedJson(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > MAX_OPENAI_RESPONSE_BYTES) throw new Error("AI provider response exceeded the size limit");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_OPENAI_RESPONSE_BYTES) {
    throw new Error("AI provider response exceeded the size limit");
  }
  return JSON.parse(text) as Record<string, any>;
}

function extractOutputText(body: Record<string, any>) {
  if (typeof body.output_text === "string") return body.output_text;
  if (!Array.isArray(body.output)) return "";
  return body.output
    .flatMap((item: any) => (Array.isArray(item.content) ? item.content : []))
    .map((item: any) => (typeof item.text === "string" ? item.text : ""))
    .join("");
}

function extractSourceUrls(body: Record<string, any>) {
  const urls = new Set<string>();
  for (const item of Array.isArray(body.output) ? body.output.slice(0, 100) : []) {
    for (const source of Array.isArray(item?.action?.sources) ? item.action.sources.slice(0, 50) : []) {
      if (typeof source?.url === "string") urls.add(source.url);
    }
    for (const content of Array.isArray(item?.content) ? item.content.slice(0, 50) : []) {
      for (const annotation of Array.isArray(content?.annotations) ? content.annotations.slice(0, 50) : []) {
        if (typeof annotation?.url === "string") urls.add(annotation.url);
      }
    }
  }
  return [...urls].slice(0, 20);
}

export async function runOpenAI(args: {
  input: string;
  instructions: string;
  model: string;
  webResearch: boolean;
  timeoutMs: number;
  outputSchema?: Record<string, unknown>;
  outputName?: string;
  maxOutputTokens?: number;
  provider?: "openai" | "openrouter";
  fallbackModels?: string[];
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("AI provider timed out"), args.timeoutMs);
  try {
    const provider = args.provider ?? "openai";
    const apiKey = provider === "openrouter" ? env.OPENROUTER_API_KEY : env.OPENAI_API_KEY;
    const response = await fetch(provider === "openrouter" ? "https://openrouter.ai/api/v1/responses" : "https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(provider === "openrouter" ? { "HTTP-Referer": "https://nodebook.app", "X-Title": "NodeBook NodeAgent" } : {}),
      },
      body: JSON.stringify({
        model: args.model,
        ...reasoningConfig(provider, args.model),
        ...(provider === "openrouter" && args.fallbackModels?.length ? { models: args.fallbackModels.slice(0, 3) } : {}),
        store: false,
        max_output_tokens: args.maxOutputTokens ?? 2_500,
        instructions: args.instructions,
        input: args.input,
        tools: args.webResearch ? [{ type: "web_search" }] : [],
        text: {
          format: {
            type: "json_schema",
            name: args.outputName ?? "nodebook_agent_result",
            strict: true,
            schema: args.outputSchema ?? RESULT_JSON_SCHEMA,
          },
        },
      }),
      signal: controller.signal,
    });
    const body = await readBoundedJson(response);
    if (!response.ok) throw new Error(`AI provider rejected the run (${response.status})`);
    const content = extractOutputText(body);
    if (!content.trim()) throw new Error("AI provider returned an empty response");
    let result: unknown;
    try {
      result = JSON.parse(content);
    } catch {
      throw new Error("AI provider returned malformed structured output");
    }
    const usage: WorkflowUsage = {
      inputTokens: typeof body.usage?.input_tokens === "number" ? body.usage.input_tokens : null,
      outputTokens: typeof body.usage?.output_tokens === "number" ? body.usage.output_tokens : null,
      totalTokens: typeof body.usage?.total_tokens === "number" ? body.usage.total_tokens : null,
    };
    return { result, sources: extractSourceUrls(body), usage, actualModel: typeof body.model === "string" ? body.model : args.model };
  } finally {
    clearTimeout(timeout);
  }
}
