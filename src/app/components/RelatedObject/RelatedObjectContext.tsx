import { createContext, useContext } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";

/**
 * The view type of the related object. This determines what is displayed in the
 * related object view.
 * - `edit`: The default view where edits update the object content (or create a
 *   new object when it's rendered as a link)
 * - `replace`: The view where the user can replace the object with another
 *   object.
 */
export type RelatedObjectViewType = "edit" | "replace";

const TreeNodeContext = createContext<{
  treeNode: DescendantTreeNode;
  relationComboboxIsOpen: boolean;
  setRelationComboboxIsOpen: (isOpen: boolean) => void;
  updatingRelationType: boolean;
  setUpdatingRelationType: (updating: boolean) => void;
  viewType: RelatedObjectViewType;
  setViewType: (viewType: RelatedObjectViewType) => void;
  openRelComboBox: () => void;
} | null>(null);

export const useTreeNode = () => {
  const context = useContext(TreeNodeContext);
  if (!context) {
    throw new Error("useRelationAtPath must be used within a RelationAtPathContext provider");
  }
  return context;
};

export const TreeNodeProvider = TreeNodeContext.Provider;
