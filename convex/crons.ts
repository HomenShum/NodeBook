import { cronJobs } from "convex/server";
import { makeFunctionReference } from "convex/server";

const crons = cronJobs();
const benchmarkFreeModels = makeFunctionReference<"action", { reason: string }, unknown>("modelRouting:benchmarkFreeModels");

crons.daily("refresh NodeAgent free-model benchmark", { hourUTC: 9, minuteUTC: 15 }, benchmarkFreeModels, { reason: "daily_catalog_refresh" });

export default crons;
