"use client";
import { createContext, useState } from "react";

// Create a context to manage global expand/collapse state
export const FilteredNodesContext = createContext<{
  globalExpanded: boolean;
  setGlobalExpanded: (expanded: boolean) => void;
  instances: Set<string>;
  registerInstance: (id: string) => void;
  unregisterInstance: (id: string) => void;
}>({
  globalExpanded: false,
  setGlobalExpanded: () => {},
  instances: new Set<string>(),
  registerInstance: () => {},
  unregisterInstance: () => {},
});

export const FilteredNodesProvider = ({ children }: { children: React.ReactNode }) => {
  const [globalExpanded, setGlobalExpanded] = useState(false);
  const [instances, setInstances] = useState<Set<string>>(new Set());

  const registerInstance = (id: string) => {
    setInstances((prev) => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  };

  const unregisterInstance = (id: string) => {
    setInstances((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  return (
    <FilteredNodesContext.Provider
      value={{
        globalExpanded,
        setGlobalExpanded,
        instances,
        registerInstance,
        unregisterInstance,
      }}
    >
      {children}
    </FilteredNodesContext.Provider>
  );
};
