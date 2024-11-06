import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $createRangeSelection, $getSelection, $isRangeSelection, $setSelection, LexicalNode, TextNode } from "lexical";
import { useEffect } from "react";

import { Match, findUrlMatches, matchesToNodes } from "@/app/editor/utils/links";
import { $isLinkNode, LinkNode } from "@/app/graph/LinkNode";

/** Iterate over the old nodes, accumulate their length, and add the offset of the selected node */
const saveSelectionOffset = (nodes: LexicalNode[]): number | null => {
  const lexicalSelection = $getSelection();
  if (!lexicalSelection || !$isRangeSelection(lexicalSelection)) return null;

  let cumulativeOffset = 0;
  for (const node of nodes) {
    if (node.isSelected()) {
      return cumulativeOffset + lexicalSelection.anchor.offset;
    } else {
      cumulativeOffset += node.getTextContent().length;
    }
  }

  return null;
};

/** Iterate over the new nodes, reduce the offset until it's smaller than a node's length, and set the selection */
const restoreSelection = (newNodes: LexicalNode[], offset: number | null) => {
  const newSelection = $createRangeSelection();
  if (offset !== null) {
    for (let i = 0; i < newNodes.length; i++) {
      const newNode = newNodes[i];
      const nodeLength = newNode.getTextContent().length;

      if (offset <= nodeLength) {
        const key = newNode.getKey();
        newSelection.anchor.set(key, offset, "text");
        newSelection.focus.set(key, offset, "text");
        $setSelection(newSelection);
        return;
      }
      offset -= nodeLength;
    }
    // As the fallback, set the selection to the end of the last node.
    // We don't use the `selectEnd` method because that takes focus too,
    // and this function runs in cases where the current editor doesn't have
    // focus and so we don't want it to steal it.
    const lastNode = newNodes[newNodes.length - 1];
    const key = lastNode.getKey();
    const length = lastNode.getTextContent().length;
    newSelection.anchor.set(key, length, "text");
    newSelection.focus.set(key, length, "text");
    $setSelection(newSelection);
  }
};

/** Replace the old nodes with the new nodes */
const replaceNodes = (oldNodes: LexicalNode[], newNodes: LexicalNode[]) => {
  if (!oldNodes.length || !newNodes.length) return;
  const savedOffset = saveSelectionOffset(oldNodes);

  while (oldNodes.length > 1) {
    oldNodes.pop()?.remove();
  }

  // Replacing the node right away breaks inserting, so we need to insert the new nodes first
  // Inserting in the reverse order doesn't work, hence `nextNode`
  let nextNewNode = oldNodes[0];
  for (let i = 1; i < newNodes.length; i++) {
    nextNewNode.insertAfter(newNodes[i]);
    nextNewNode = newNodes[i];
  }

  oldNodes[0].replace(newNodes[0]);
  restoreSelection(newNodes, savedOffset);
};

/** Check if the URLs of the matches and the nodes differ */
const doUrlsDiffer = (matches: Match[], nodes: LexicalNode[]): boolean => {
  const linkNodes = nodes.filter($isLinkNode);
  if (matches.length !== linkNodes.length) return true;

  for (let i = 0; i < linkNodes.length; i++) {
    if (linkNodes[i].url !== matches[i].url) {
      return true;
    }
  }

  return false;
};

export const LinkPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      // When a text node is changed, check if it contains a URL and replace it with a LinkNode
      // When a text node adjacent to a LinkNode is changed, check if both of them together form a larger URL and merge them if they do
      editor.registerNodeTransform(TextNode, (textNode) => {
        const nodesToReplace = [textNode];

        const prevNode = textNode.getPreviousSibling();
        if ($isLinkNode(prevNode)) {
          nodesToReplace.unshift(prevNode);
        }

        const nextNode = textNode.getNextSibling();
        if ($isLinkNode(nextNode)) {
          nodesToReplace.push(nextNode);
        }

        const text = nodesToReplace.map((node) => node.getTextContent()).join("");
        const matches = findUrlMatches(text);
        const newNodes = matchesToNodes(text, matches);

        // If there's at least one link node, and the URLs differ for the possible existing nodes, replace them
        if (newNodes.filter($isLinkNode).length && doUrlsDiffer(matches, nodesToReplace)) {
          replaceNodes(nodesToReplace, newNodes);
        }
      }),

      // When a LinkNode is changed, check if it contains a URL and either update the node or change it to a TextNode if it doesn't
      editor.registerNodeTransform(LinkNode, (linkNode) => {
        const text = linkNode.getTextContent();
        const newNodes = matchesToNodes(text, findUrlMatches(text));

        if (newNodes.length === 1 && newNodes[0] instanceof LinkNode && newNodes[0].url === linkNode.url) {
          return; // Ignore if there is no actual change
        } else if (newNodes.length) {
          replaceNodes([linkNode], newNodes);
        } else {
          replaceNodes([linkNode], [new TextNode(text)]);
        }
      }),
    );
  }, [editor]);

  return null;
};
