import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND, PASTE_COMMAND } from "lexical";
import { useEffect, useRef } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { useTree } from "@/app/tree/TreeContext";
import { uuid } from "@/app/util";

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
  const shiftWasPressed = useRef<boolean>(false);

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key.toLowerCase() === "v" && (event.ctrlKey || event.metaKey) && event.shiftKey) {
          shiftWasPressed.current = true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand<ClipboardEvent>(
      PASTE_COMMAND,
      (event) => {
        const shiftKey = shiftWasPressed.current;
        shiftWasPressed.current = false;
        if (!(object instanceof GraphNode) || !event.clipboardData) return false;
        const lines = shiftKey
          ? [event.clipboardData.getData("Text")]
          : event.clipboardData
              .getData("Text")
              .split("\n")
              .filter((l) => l.length > 0) ?? [];

        if (lines.length > 0) {
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
          const newRelatedIds: string[] = [];
          lines.reverse().forEach((line) => {
            const relationId = uuid();
            newRelatedIds.push(relationId);
            txs.push({
              type: "addChildNode",
              transaction: {
                parentId: parent.id,
                nodeProps: { content: line },
                relationProps: { id: relationId },
                after: relation,
              },
            });
          });
          // inside the same group
          const groupId = treeNode.parentGroup.id;
          if (groupId === "pinned" || groupId === "noteContent") {
            txs.push({
              type: "addRelationToList",
              transaction: {
                objectId: treeNode.parent.object.id,
                relationId: newRelatedIds,
                listType: groupId,
                after: relation,
              },
            });
          }

          graphStore.applyCombinedTransaction(txs).then(() => {
            tree.setFocusedNode(path);
          });

          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [object, parent, relation, graphStore, editor, path, tree, treeNode]);
  return null;
};
