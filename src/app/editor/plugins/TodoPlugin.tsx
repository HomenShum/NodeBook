import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { $atEditorStart } from "@/app/editor/utils/selection";
import { TreeNode } from "@/app/tree/nodes";

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
        if (!selection || !$isRangeSelection(selection) || !selection.isCollapsed()) return false;
        if (event.key === "Backspace" && treeNode.isTodoItem && $atEditorStart()) {
          graphStore.updateNode({
            nodeId: treeNode.object.id,
            nodeProps: { isChecked: null },
          });
          return true;
        }

        //If object is already a to-do, do not perform any operation.
        if (!(event.key === "]") || treeNode.object.objectType !== "node" || treeNode.isTodoItem) {
          return false;
        }
        const rootTextContent = editor.getRootElement()?.textContent?.toLowerCase() || "";

        const shouldCreateCheckedTodo = rootTextContent.startsWith("[x");
        const shouldCreateEmptyTodo =
          !shouldCreateCheckedTodo && (rootTextContent.startsWith("[") || rootTextContent.startsWith("[ "));

        if (!shouldCreateEmptyTodo && !shouldCreateCheckedTodo) return false;
        const prefixSize = !rootTextContent.startsWith("[x") && !rootTextContent.startsWith("[ ") ? 1 : 2;

        const points = selection.getStartEndPoints();
        if (!points || points[0].offset !== prefixSize) return false;
        event.preventDefault();
        event.stopPropagation();

        // Have to specifically update the content here so undo goes back to just the text
        if (treeNode.object.content[0].type !== "image") {
          treeNode.object.content[0].value =
            rootTextContent.slice(0, prefixSize) + "]" + treeNode.object.content[0].value.slice(prefixSize);
        }

        const content = treeNode.object.content.map((chip) => ({ ...chip }));
        if (content[0].type !== "image") {
          content[0].value = content[0].value.substring(prefixSize + 1);
        }

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

  // cmd/ctrl + shift + y toggle
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      action((event) => {
        if (!event) return false;
        if (event.key === "Y" && (event.metaKey || event.ctrlKey) && event.shiftKey) {
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
