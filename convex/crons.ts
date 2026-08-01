import { cronJobs } from "convex/server";
import { makeFunctionReference } from "convex/server";

const crons = cronJobs();
const benchmarkFreeModels = makeFunctionReference<"action", { reason: string }, unknown>("modelRouting:benchmarkFreeModels");

crons.hourly("refresh NodeAgent free-model catalog", { minuteUTC: 15 }, benchmarkFreeModels, { reason: "catalog_refresh" });

export default crons;
