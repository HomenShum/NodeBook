import type { WorkflowUsage } from "@/app/api/query/workflowAgent";

export function combineObservedUsage(parts: WorkflowUsage[]): WorkflowUsage {
  const total = (field: keyof WorkflowUsage) => parts.length > 0 && parts.every((part) => typeof part[field] === "number")
    ? parts.reduce((sum, part) => sum + (part[field] ?? 0), 0)
    : null;
  return { inputTokens: total("inputTokens"), outputTokens: total("outputTokens"), totalTokens: total("totalTokens") };
}

export function boundedExecutionFailureReason(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : "NodeAgent execution failed";
  return message.slice(0, 1_000);
}
