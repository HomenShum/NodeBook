"use client";
import { createContext, useContext } from "react";

import { ViewStore } from "./ViewStore";

const ViewStoreContext = createContext<null | ViewStore>(null);

export const ViewStoreProvider = ViewStoreContext.Provider;

export const useViewStore = () => {
  const store = useContext(ViewStoreContext);
  if (!store) {
    throw new Error("useViewStore must be used within a ViewStoreProvider");
  }
  return store;
};
