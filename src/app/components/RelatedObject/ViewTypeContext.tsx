import { createContext, useContext } from "react";

import { RelatedObjectViewType } from "./RelatedObjectView";

type ViewTypeContextType = {
  viewType: RelatedObjectViewType;
  setViewType: (v: RelatedObjectViewType) => void;
};

const ViewTypeContext = createContext<ViewTypeContextType | null>(null);

export const useViewType = () => {
  const context = useContext(ViewTypeContext);
  if (!context) {
    throw new Error("useViewType must be used within a ViewTypeContext provider");
  }

  return context;
};

export const ViewTypeProvider = ViewTypeContext.Provider;
