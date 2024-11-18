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
  const { treeNode } = useTreeNode();
  const tree = treeNode.tree;
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
        const lines = normalizeDepth(
          mewData
            ? getLinesFromMewData(mewData, shiftKey)
            : getLinesFromPlainText(event.clipboardData.getData("text/plain"), shiftKey),
        );

        if (lines.length > 0) {
          const txs: TxCombined = [];
          // Insert the first line into the current node
          const firstLine = lines.shift();
          const groupId = treeNode.parentGroup.id;
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

            // If there are chips with links, add the links as children nodes of the current node.
            // The parent of these nodes will be the current node.
            txs.push(...getLinkAdditionTxs(firstLine.chips, object.id, groupId));
          }

          // Add to this arrays as depth increases during iterating over lines, remove as it decreases
          const objectsAtDepth: string[] = [treeNode.parent.object.id, object.id];
          const relationsAtDepth: string[] = ["UNUSED", relationWithParent.id];
          let lastDepth = 0;

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
                after: relationsAtDepth[depth + 1],
              },
            });

            txs.push(...getLinkAdditionTxs(chips, newNodeId, groupId));

            // Add the newly created relations to the same group as this node's parent
            if (groupId === "pinned" || groupId === "noteContent") {
              txs.push({
                type: "addRelationToList",
                transaction: {
                  objectId: objectsAtDepth[depth],
                  relationId: relationId,
                  listType: groupId,
                  after: relationsAtDepth[depth + 1],
                },
              });
            }

            // When we go a level more shallow, remove the objects and relations up of the current level
            if (depth < lastDepth) {
              objectsAtDepth.splice(depth + 1);
              relationsAtDepth.splice(depth + 1);
            }
            lastDepth = depth;

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

const getLinkAdditionTxs = (chips: Chip[], parentId: string, groupId: string) => {
  // If the firstline consists of only a single link chip, return an empty array
  if (chips.length === 1 && chips[0].type === "link") {
    return [];
  }
  // This is just to get the unique links from the chips. Thank you Brendan Eich.
  const links = Array.from(new Set(chips.filter((chip) => chip.type === "link").map((chip) => chip.value)))
    .map((value) => {
      return chips.find((chip) => chip.type === "link" && chip.value === value);
    })
    .filter((chip) => chip !== undefined) as Chip[];
  const txs: TxCombined = [];

  links.forEach((link) => {
    const newNodeId = uuid();
    const relationId = uuid();

    txs.push({
      type: "addChildNode",
      transaction: {
        parentId: parentId,
        nodeProps: { id: newNodeId, content: [link] },
        relationProps: { id: relationId },
      },
    });
  });
  return txs;
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

export const getLinesFromPlainText = (text: string, shiftKey: boolean): ChipsWithContext[] => {
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
export const getDepthFromTextOffset = (line: string): { depth: number; remainingText: string } => {
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
      depth += Math.floor(spaces / 2);
    } else {
      break;
    }
  }

  return { depth, remainingText: line.replace(/^\s+/, "") };
};

/**
 * Make sure that any next line is at most 1 level deeper than the current line
 * That way, all nested nodes will have a parent
 */
export const normalizeDepth = (lines: ChipsWithContext[]): ChipsWithContext[] => {
  const depthsMap = new Map<number, number>();
  let lastDepth = 0;

  return lines.map(({ chips, depth }) => {
    let newDepth: number;

    if (depth - lastDepth > 1 && !depthsMap.has(depth)) {
      newDepth = lastDepth + 1;
      depthsMap.set(depth, newDepth);
    } else {
      newDepth = depthsMap.get(depth) ?? depth;
    }

    lastDepth = newDepth;
    return { chips, depth: newDepth };
  });
};
