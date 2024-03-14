"use client";
import { toJS } from "mobx";
import { createContext, useContext } from "react";
import { ViewStore } from "../model/ViewStore";
import { graphStore } from "./graph";

export const viewStore = new ViewStore(graphStore);
if (typeof window !== "undefined") {
  (window as any).toJS = toJS;
  (window as any).viewStore = viewStore; // for debugging
}

export const ViewStoreContext = createContext(viewStore);

export const useViewStore = () => {
  return useContext(ViewStoreContext);
};
