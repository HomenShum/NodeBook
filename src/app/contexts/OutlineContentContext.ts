import { createContext, useContext } from "react";

type ParentComponent = "OutlineView" | "QuickCapture" | "RightSidebar";

export const OutlineParentContext = createContext<ParentComponent | null>(null);

export const useOutlineParent = () => {
  const parentComponent = useContext(OutlineParentContext);
  if (!parentComponent) {
    throw new Error("useOutlineParent must be used within an OutlineParentContext");
  }
  return parentComponent;
};
