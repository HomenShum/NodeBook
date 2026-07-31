/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentRuns from "../agentRuns.js";
import type * as agentWorkflows from "../agentWorkflows.js";
import type * as chunkedNodeUpdates from "../chunkedNodeUpdates.js";
import type * as graph from "../graph.js";
import type * as http from "../http.js";
import type * as migration from "../migration.js";
import type * as nodeDocuments from "../nodeDocuments.js";
import type * as server from "../server.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentRuns: typeof agentRuns;
  agentWorkflows: typeof agentWorkflows;
  chunkedNodeUpdates: typeof chunkedNodeUpdates;
  graph: typeof graph;
  http: typeof http;
  migration: typeof migration;
  nodeDocuments: typeof nodeDocuments;
  server: typeof server;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
