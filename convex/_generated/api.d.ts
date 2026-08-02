/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentStepJournal from "../agentStepJournal.js";
import type * as agentWorkflows from "../agentWorkflows.js";
import type * as chunkedNodeUpdates from "../chunkedNodeUpdates.js";
import type * as crons from "../crons.js";
import type * as graph from "../graph.js";
import type * as http from "../http.js";
import type * as migration from "../migration.js";
import type * as modelRouting from "../modelRouting.js";
import type * as nodeDocuments from "../nodeDocuments.js";
import type * as nodeEmbeddings from "../nodeEmbeddings.js";
import type * as server from "../server.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentStepJournal: typeof agentStepJournal;
  agentWorkflows: typeof agentWorkflows;
  chunkedNodeUpdates: typeof chunkedNodeUpdates;
  crons: typeof crons;
  graph: typeof graph;
  http: typeof http;
  migration: typeof migration;
  modelRouting: typeof modelRouting;
  nodeDocuments: typeof nodeDocuments;
  nodeEmbeddings: typeof nodeEmbeddings;
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
