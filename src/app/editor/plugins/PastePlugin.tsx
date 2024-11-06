import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND, PASTE_COMMAND } from "lexical";
import { useEffect, useRef } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { transformTextToChips } from "@/app/editor/utils/links";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { ChipsWithContext, MEW_CLIPBOARD_MIMETYPE } from "@/app/tree/clipboard";
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
  const { object, relationWithParent, path } = treeNode;
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

        const mewData = event.clipboardData.getData(MEW_CLIPBOARD_MIMETYPE);
        const lines = mewData
          ? getLinesFromMewData(mewData, shiftKey)
          : getLinesFromPlainText(event.clipboardData.getData("text/plain"), shiftKey);

        if (lines.length > 0) {
          const txs: TxCombined = [];

          // Insert the first line into the current node
          const firstLine = lines.shift();
          if (firstLine) {
            const selection = $getSelection();
            let newContent: Chip[];
            if (selection) {
              const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);
              newContent = [...chipsBefore, ...firstLine.chips, ...chipsAfter];
            } else {
              // There *should* be a selection in the case where we're handling a paste, but if somehow
              // there isn't, we'll just append the first line to the current content.
              newContent = [...object.content, ...firstLine.chips];
            }

            // Depth is ignored for the first line, since we just add it to the current node
            txs.push({ type: "updateNode", transaction: { nodeId: object.id, nodeProps: { content: newContent } } });
          }

          // Add to this arrays as depth increases during iterating over lines, remove as it decreases
          const objectsAtDepth: string[] = [treeNode.parent.object.id, object.id];
          const relationsAtDepth: string[] = [relationWithParent.id];

          // Then for the remaining lines, create children positioned after the correct parent
          lines.forEach(({ chips, depth }) => {
            const newNodeId = uuid();
            const relationId = uuid();

            txs.push({
              type: "addChildNode",
              transaction: {
                parentId: objectsAtDepth[depth],
                nodeProps: { id: newNodeId, content: chips },
                relationProps: { id: relationId },
                after: relationsAtDepth[depth],
              },
            });

            // Add the newly created relations to the same group as this node's parent
            const groupId = treeNode.parentGroup.id;
            if (groupId === "pinned" || groupId === "noteContent") {
              txs.push({
                type: "addRelationToList",
                transaction: {
                  objectId: treeNode.parent.object.id,
                  relationId: relationId,
                  listType: groupId,
                  after: relationsAtDepth[depth],
                },
              });
            }

            objectsAtDepth[depth + 1] = newNodeId;
            relationsAtDepth[depth + 1] = relationId;
          });

          graphStore.applyCombinedTransaction(txs).then(() => {
            tree.setFocusedNode(path);
            // TODO : expand all newly added nodes
          });

          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [object, relationWithParent, graphStore, editor, path, tree, treeNode]);
  return null;
};

const getLinesFromMewData = (mewData: string, shiftKey: boolean): ChipsWithContext[] => {
  const chipParts = JSON.parse(mewData) as ChipsWithContext[];
  return shiftKey
    ? [
        // Line-up the chips for one long node with a space between each constituent original node
        chipParts.reduce(
          (val: ChipsWithContext, acc: ChipsWithContext, i) => {
            acc.chips.push(...val.chips);
            if (i === 0) acc.chips.push({ type: "text", value: " " });
            return acc;
          },
          // Accumulate into a single object with a depth of 0
          { chips: [], depth: 0 } as ChipsWithContext,
        ),
      ]
    : chipParts; // Or just use the chips for the same number of nodes
};

const getLinesFromPlainText = (text: string, shiftKey: boolean): ChipsWithContext[] => {
  return shiftKey
    ? [{ chips: transformTextToChips(text), depth: 0 }]
    : text
        .split("\n")
        .filter((l) => l.length > 0)
        .map((value) => {
          const { remainingText, depth } = getDepthFromTextOffset(value);
          return { chips: transformTextToChips(remainingText), depth };
        }) ?? [];
};

/** Add 1 depth for each tab or each 2 spaces at the beginning of the line */
const getDepthFromTextOffset = (line: string): { depth: number; remainingText: string } => {
  let depth = 0;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\t") {
      depth++;
    } else if (line[i] === " ") {
      let spaces = 1;
      while (line[i + 1] === " ") {
        spaces++;
        i++;
      }
      depth += Math.floor(spaces / 4);
    } else {
      break;
    }
  }

  return { depth, remainingText: line.replace(/^\s+/, "") };
};
