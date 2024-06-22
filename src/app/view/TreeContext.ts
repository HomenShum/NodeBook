import { createContext, useContext } from "react";

import { Tree } from "./Tree";

export const TreeContext = createContext<Tree | null>(null);

export const useTree = () => {
  const tree = useContext(TreeContext);
  if (!tree) {
    throw new Error("useOutline must be used within an OutlineProvider");
  }
  return tree;
};
