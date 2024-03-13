"use client";
import { createContext, useContext } from "react";
import { GraphStore } from "../model/GraphStore";
import { env } from "../envFrontend";
import { RemoteGraphStore } from "../model/RemoteGraphStore";

export const graphStore = new GraphStore(
  env.isPersistenceEnabled ? new RemoteGraphStore() : undefined
);

export const GraphStoreContext = createContext<GraphStore>(graphStore);

export const useGraphStore = () => {
  return useContext(GraphStoreContext);
};
