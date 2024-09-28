import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_LOW, PASTE_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useTree } from "@/app/tree/TreeContext";

/**
 * Plugin that allows pasting multiple lines of text into a node.
 */
export const PastePlugin = () => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const { treeNode } = useTreeNode();
  const { object, relationWithParent: relation, path } = treeNode;
  const parent = treeNode.parent.object;

  useEffect(() => {
    return editor.registerCommand<ClipboardEvent>(
      PASTE_COMMAND,
      (event) => {
        if (!(object instanceof GraphNode)) return false;
        const lines = event.clipboardData?.getData("Text")?.split("\n") ?? [];
        if (lines.length > 1) {
          const txs: TxCombined = [];

          // if the current node is empty, set the first line as its content
          if (object.text === "") {
            const line = lines.shift() ?? "";
            txs.push({ type: "updateNode", transaction: { nodeId: object.id, nodeProps: { content: line } } });
          }

          // then for the remaining lines, create children positioned after the parent
          lines.reverse().forEach((line) => {
            txs.push({
              type: "addChildNode",
              transaction: { parentId: parent.id, nodeProps: { content: line }, after: relation },
            });
          });

          graphStore.applyCombinedTransaction(txs).then(() => {
            tree.setFocusedNode(path);
          });

          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [object, parent, relation, graphStore, editor, path, tree]);
  return null;
};
