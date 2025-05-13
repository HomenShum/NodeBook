import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";

export const ToggleEditablePlugin = ({ treeNode, editable }: { treeNode: DescendantTreeNode; editable: boolean }) => {
  const [editor] = useLexicalComposerContext();
  const tree = treeNode.tree;

  // toggle editor editable
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return null;
};
