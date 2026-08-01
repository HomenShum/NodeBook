import {
  mutationGeneric,
  internalMutationGeneric,
  internalActionGeneric,
  internalQueryGeneric,
  queryGeneric,
  type DataModelFromSchemaDefinition,
  type GenericMutationCtx,
  type GenericQueryCtx,
  type MutationBuilder,
  type QueryBuilder,
} from "convex/server";

import schema from "./schema";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type QueryCtx = GenericQueryCtx<DataModel>;

export const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;
export const internalMutation: MutationBuilder<DataModel, "internal"> = internalMutationGeneric;
export const internalAction = internalActionGeneric;
export const internalQuery: QueryBuilder<DataModel, "internal"> = internalQueryGeneric;
export const query: QueryBuilder<DataModel, "public"> = queryGeneric;
