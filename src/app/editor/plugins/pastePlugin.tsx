import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_LOW, PASTE_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
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

          // Insert the first line into the current node
          const firstLine = lines.shift();
          if (firstLine) {
            let newContent: Chip[] = [];
            const selection = $getSelection();
            if (selection) {
              const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);
              newContent = [...chipsBefore, { type: "text", value: firstLine }, ...chipsAfter];
            } else {
              // There *should* be a selection in the case where we're handling a paste, but if somehow
              // there isn't, we'll just append the first line to the current content.
              newContent = [...object.content, { type: "text", value: firstLine }];
            }
            txs.push({ type: "updateNode", transaction: { nodeId: object.id, nodeProps: { content: newContent } } });
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
