// The three golden metrics — task-completion-rate, tool-call-error-rate,
// p99-latency-ms — computed on read from receipts agentWorkflows already
// persists (agentRuns, agentSteps, agentRuntimeEvaluations). No new
// instrumentation and no metrics framework: the stored retention window IS the
// measurement window.
import { query, QueryCtx } from "./server";

// Windows mirror the pruning bounds in agentWorkflows.ts (not exported there):
// MAX_AGENT_RUNS_PER_OWNER, MAX_AGENT_STEPS_PER_RUN, MAX_RUNTIME_EVALUATIONS_PER_OWNER.
const RUN_WINDOW = 200;
const STEPS_PER_RUN = 100;
const EVAL_WINDOW = 100;

export type GoldenMetricInputs = {
  runStatuses: string[]; // agentRuns.status over the stored window
  stepStatuses: string[]; // agentSteps.status for those runs
  latenciesMs: number[]; // agentRuntimeEvaluations.latencyMs over the stored window
};

// Nearest-rank percentile over the raw sample; null when there is no data
// rather than a fabricated zero (HONEST_SCORES).
export function nearestRankPercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)];
}

export function computeGoldenMetrics(inputs: GoldenMetricInputs) {
  const totalRuns = inputs.runStatuses.length;
  // A run completed its task when it reached a terminal user-visible result:
  // every status except "failed". proposed/rejected/undone are user decisions
  // on a successfully produced proposal, not agent failures.
  const completedRuns = inputs.runStatuses.filter((status) => status !== "failed").length;
  // Scoping: agentSteps records one row per investigation tool call
  // (find_nodes, get_node_details, ...), so this is genuinely per-tool-call
  // granularity — not the coarser model-call counter in modelRouting, which
  // only persists consecutiveFailures, not lifetime totals. "failed" is an
  // errored call; "repaired" recovered and is not counted as an error.
  const totalCalls = inputs.stepStatuses.length;
  const erroredCalls = inputs.stepStatuses.filter((status) => status === "failed").length;
  return {
    "task-completion-rate": totalRuns ? completedRuns / totalRuns : null,
    "tool-call-error-rate": totalCalls ? erroredCalls / totalCalls : null,
    "p99-latency-ms": nearestRankPercentile(inputs.latenciesMs, 99),
    sampleSizes: { runs: totalRuns, toolCalls: totalCalls, latencies: inputs.latenciesMs.length },
  };
}

async function authenticatedOwner(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("AUTH_REQUIRED: an authenticated identity is required");
  return identity.subject;
}

export const goldenMetrics = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await authenticatedOwner(ctx);
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_owner_started", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(RUN_WINDOW);
    // ponytail: one bounded steps query per run (max 200 x 100 rows); a
    // by_owner index on agentSteps if this query ever shows up in profiles.
    const stepStatuses: string[] = [];
    for (const run of runs) {
      const steps = await ctx.db
        .query("agentSteps")
        .withIndex("by_owner_run_sequence", (q) => q.eq("ownerId", ownerId).eq("runId", run.runId))
        .take(STEPS_PER_RUN);
      for (const step of steps) stepStatuses.push(step.status);
    }
    const evaluations = await ctx.db
      .query("agentRuntimeEvaluations")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(EVAL_WINDOW);
    return computeGoldenMetrics({
      runStatuses: runs.map((run) => run.status),
      stepStatuses,
      latenciesMs: evaluations.map((evaluation) => evaluation.latencyMs),
    });
  },
});
