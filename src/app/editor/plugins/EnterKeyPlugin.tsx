import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { $getChipsAroundSelection } from "@/app/editor/utils";
import { GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useTree } from "@/app/tree/TreeContext";
import { DescendantTreeNode } from "@/app/tree/nodes";

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const EnterKeyPlugin = ({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const object = treeNode.object;
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;
  const pathToNodeStr = treeNode.path;
  const pathToParentNodes = treeNode.parent.path;
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
  }, [editor, graphStore, tree, object, parent, pathToNodeStr, pathToParentNodes, relation, treeNode]);

  return null;
};
