import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";
import { useViewStore } from "@/app/view/useViewStore";

interface Props {
  treeNode: DescendantTreeNode;
}

export const ViewControllerRegistryPlugin = ({ treeNode }: Props) => {
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    treeNode.registerLexicalEditor(editor);
    viewStore.registerEditor(treeNode.path, editor);
    editor.getRootElement()?.setAttribute("data-editor-path", treeNode.path);

    return () => {
      viewStore.removeEditor(treeNode.path);
    };
  }, [treeNode, editor, viewStore]);
  return null;
};
