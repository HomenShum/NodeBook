"use client";
import { createContext, useContext } from "react";
import { OutlineViewStore } from "../model/OutlineViewStore";
import { graphStore } from "./graph";

export const outlineViewStore = new OutlineViewStore(graphStore);
// (window as any).outlineViewStore = outlineViewStore; // for debugging

export const OutlineViewStoreContext = createContext(outlineViewStore);

export const useOutlineViewStore = () => {
  return useContext(OutlineViewStoreContext);
};
