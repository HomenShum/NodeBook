import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { $atEditorStart } from "@/app/editor/utils/selection";
import { RootTreeNode, TreeNode } from "@/app/tree/nodes";

/**
 * Plugin to create and delete todo state for a node.
 */
export const TodoPlugin = ({ treeNode }: { treeNode: TreeNode }) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  // [ ] toggle
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      action((event) => {
        if (!event) return false;
        const selection = $getSelection();
        if (treeNode instanceof RootTreeNode || !selection || !$isRangeSelection(selection) || !selection.isCollapsed())
          return false;
        if ((event.key === "Backspace" || event.key === "Delete") && treeNode.isTodoItem && $atEditorStart()) {
          graphStore.updateNode({
            nodeId: treeNode.object.id,
            nodeProps: { isChecked: null },
          });
          return true;
        }

        //If object is already a to-do, do not perform any operation.
        if (!(event.key === " ") || treeNode.object.objectType !== "node" || treeNode.isTodoItem) {
          return false;
        }
        const shouldCreateEmptyTodo = editor.getRootElement()?.textContent?.startsWith("[]") || false;
        const shouldCreateCheckedTodo = editor.getRootElement()?.textContent?.toLowerCase()?.startsWith("[x]") || false;
        if (!shouldCreateEmptyTodo && !shouldCreateCheckedTodo) return false;
        const prefixSize = shouldCreateEmptyTodo ? 2 : 3;
        const points = selection.getStartEndPoints();
        if (!points || points[0].offset !== prefixSize) return false;
        event.preventDefault();
        event.stopPropagation();
        const content = [...treeNode.object.content];
        content[0].value = content[0].value.substring(prefixSize);
        graphStore.updateNode({
          nodeId: treeNode.object.id,
          nodeProps: { content, isChecked: shouldCreateCheckedTodo },
        });
        treeNode.tree.setFocusedNode(treeNode.id, "start");
        return true;
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, graphStore, treeNode]);

  // cmd + shift + y toggle
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      action((event) => {
        if (!event) return false;
        if (event.key === "y" && event.metaKey && event.shiftKey) {
          if (treeNode.tree.selection?.type !== "editor") return false;
          treeNode.tree.toggleEditorSelectionTodo();
          return true;
        }
        return false;
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, treeNode]);

  return null;
};
