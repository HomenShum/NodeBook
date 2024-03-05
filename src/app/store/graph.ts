"use client";
import { createContext, useContext } from "react";
import { GraphStore } from "../model/GraphStore";

export const graphStore = new GraphStore();
graphStore.createNode({ id: "root", text: "Root" });
// (window as any).nodeStore = graphStore;

export const GraphStoreContext = createContext<GraphStore>(graphStore);

export const useGraphStore = () => {
  return useContext(GraphStoreContext);
};
