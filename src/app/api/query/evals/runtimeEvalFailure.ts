import type { WorkflowUsage } from "@/app/api/query/workflowAgent";

export function combineObservedUsage(parts: WorkflowUsage[]): WorkflowUsage {
  const total = (field: keyof WorkflowUsage) => parts.length > 0 && parts.every((part) => typeof part[field] === "number")
    ? parts.reduce((sum, part) => sum + (part[field] ?? 0), 0)
    : null;
  return { inputTokens: total("inputTokens"), outputTokens: total("outputTokens"), totalTokens: total("totalTokens") };
}

export function boundedExecutionFailureReason(error: unknown) {
  const extractMessage = (value: unknown, depth = 0): string | null => {
    if (depth > 2) return null;
    if (typeof value === "string" && value.trim()) return value;
    if (value instanceof Error && value.message.trim()) return value.message;
    if (typeof value !== "object" || value === null) return null;
    if ("message" in value && typeof value.message === "string" && value.message.trim()) return value.message;
    if ("error" in value) {
      const nested = extractMessage(value.error, depth + 1);
      if (nested) return nested;
    }
    if ("cause" in value) return extractMessage(value.cause, depth + 1);
    return null;
  };
  const message = extractMessage(error) ?? "NodeAgent execution failed";
  return message.slice(0, 1_000);
}
