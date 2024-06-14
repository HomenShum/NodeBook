"use client";
import { createContext, useContext } from "react";

import { GraphStore } from "./GraphStore";

const GraphStoreContext = createContext<GraphStore | null>(null);

export const GraphStoreProvider = GraphStoreContext.Provider;

export const useGraphStore = () => {
  const store = useContext(GraphStoreContext);
  if (!store) {
    throw new Error("useGraphStore must be used within a GraphStoreProvider");
  }
  return store;
};
