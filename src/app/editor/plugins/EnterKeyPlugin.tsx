import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { GraphNode } from "@/app/graph/GraphNode";
import { useTree } from "@/app/tree/TreeContext";
import { TreeNode } from "@/app/tree/nodes";

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const EnterKeyPlugin = ({ treeNode }: { treeNode: TreeNode }) => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const object = treeNode.object;
  const relation = treeNode.relationWithParent;
  const pathToNodeStr = treeNode.path;
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      action((event) => {
        if (!event || !graphStore) return false;
        if (event.shiftKey) return false;
        const selection = $getSelection();
        if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;
        if (!(object instanceof GraphNode)) {
          // For now, we don't support splitting relations. In ENT-3653, we'll
          // decide if and how to support this.
          console.log("Splitting relations is not supported yet.");
          return false;
        }
        event.preventDefault();
        event.stopPropagation();
        const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);
        tree.split(treeNode, { before: chipsBefore, after: chipsAfter });
        return true;
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, graphStore, tree, object, pathToNodeStr, relation, treeNode]);

  return null;
};
