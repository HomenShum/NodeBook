export type RuntimeEvalCase = { caseId: string; title: string };

export type RuntimeEvalReceipt = {
  evalId: string;
  suiteId: string | null;
  caseId: string;
  benchmarkVersion: string;
  provider: "openai" | "openrouter";
  model: string;
  disposition: "read_only" | "auto_apply" | "approval_required" | "preview_only" | "execution_failed";
  passed: boolean;
  reasons: string[];
  toolOrder: string[];
  operationKinds: string[];
  selectedNodeIds: string[];
  sourceBindings: Array<{ sourceId: string; version: number; digest: string }>;
  proposalDigest: string | null;
  usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
  latencyMs: number;
  startedAtMs: number;
  completedAtMs: number;
  persisted: true;
  graphMutated: false;
};

export type RuntimeEvalHistory = {
  benchmarkVersion: string;
  cases: RuntimeEvalCase[];
  preflight: { provider: "openai" | "openrouter"; model: string; fallbackModels: string[] };
  evaluations: RuntimeEvalReceipt[];
};

export type RuntimeCaseStatus = "idle" | "running" | "passed" | "failed";

export function runtimeCaseStatus(caseId: string, receipts: RuntimeEvalReceipt[], currentCaseId: string | null): RuntimeCaseStatus {
  if (currentCaseId === caseId) return "running";
  const receipt = receipts.find((item) => item.caseId === caseId);
  if (!receipt) return "idle";
  return receipt.passed ? "passed" : "failed";
}

export function latestSuiteReceipts(evaluations: RuntimeEvalReceipt[]) {
  const suiteId = evaluations.find((evaluation) => evaluation.suiteId)?.suiteId ?? null;
  if (!suiteId) return { suiteId: null, receipts: [] as RuntimeEvalReceipt[] };
  const byCase = new Map<string, RuntimeEvalReceipt>();
  for (const evaluation of evaluations) {
    if (evaluation.suiteId === suiteId && !byCase.has(evaluation.caseId)) byCase.set(evaluation.caseId, evaluation);
  }
  return { suiteId, receipts: [...byCase.values()] };
}

export function runtimeEvalSummary(receipts: RuntimeEvalReceipt[], totalCases: number) {
  const passed = receipts.filter((receipt) => receipt.passed).length;
  const totalTokens = receipts.length > 0 && receipts.every((receipt) => typeof receipt.usage.totalTokens === "number")
    ? receipts.reduce((sum, receipt) => sum + (receipt.usage.totalTokens ?? 0), 0)
    : null;
  return {
    completed: receipts.length,
    passed,
    failed: receipts.length - passed,
    remaining: Math.max(totalCases - receipts.length, 0),
    latencyMs: receipts.reduce((sum, receipt) => sum + receipt.latencyMs, 0),
    totalTokens,
  };
}

export function selectRemainingCases(cases: RuntimeEvalCase[], receipts: RuntimeEvalReceipt[]) {
  const completed = new Set(receipts.map((receipt) => receipt.caseId));
  return cases.filter((testCase) => !completed.has(testCase.caseId));
}

export function selectFailedCases(cases: RuntimeEvalCase[], receipts: RuntimeEvalReceipt[]) {
  const failed = new Set(receipts.filter((receipt) => !receipt.passed).map((receipt) => receipt.caseId));
  return cases.filter((testCase) => failed.has(testCase.caseId));
}

export async function runRuntimeEvalCases(args: {
  cases: RuntimeEvalCase[];
  suiteId: string;
  fetchCase: (caseId: string, suiteId: string) => Promise<RuntimeEvalReceipt>;
  shouldStop: () => boolean;
  onCaseStart: (testCase: RuntimeEvalCase, index: number) => void;
  onReceipt: (receipt: RuntimeEvalReceipt) => void;
}) {
  const receipts: RuntimeEvalReceipt[] = [];
  for (let index = 0; index < args.cases.length; index += 1) {
    if (args.shouldStop()) return { receipts, stopped: true };
    const testCase = args.cases[index];
    args.onCaseStart(testCase, index);
    const receipt = await args.fetchCase(testCase.caseId, args.suiteId);
    receipts.push(receipt);
    args.onReceipt(receipt);
  }
  return { receipts, stopped: false };
}
