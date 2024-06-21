import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { getAncestorsAsArray, useTree } from "@/app/view/Tree";

/**
 * Plugin to set the current node as the view root when the user presses Cmd+. (Mac) or Ctrl+. (Windows).
 */
export const SetNodeAsRootPlugin = () => {
  const graphStore = useGraphStore();
  const tree = useTree();
  const [editor] = useLexicalComposerContext();
  const { treeNode } = useTreeNode();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
        if (!metaOrCtrl || event.key !== ".") return false;
        const relationsPath = getAncestorsAsArray(treeNode).map((node) => node.relationToChild);
        tree.setRoot(relationsPath);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, graphStore.outlineRoot.id, graphStore.thoughtstreamRoot.id, tree, treeNode]);

  return null;
};
