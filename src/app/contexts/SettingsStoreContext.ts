"use client";
import { createContext, useContext } from "react";

import { SettingsStore } from "@/app/graph/SettingsStore";

export const SettingsStoreContext = createContext<SettingsStore | null>(null);

export const useSettingsStore = () => {
  const store = useContext(SettingsStoreContext);
  if (!store) {
    throw new Error("useSettingsStore must be used within a SettingsStoreProvider");
  }
  return store;
};
