import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $createRangeSelection, $getSelection, $isRangeSelection, $setSelection, LexicalNode, TextNode } from "lexical";
import { useEffect } from "react";

import { $createLinkNode, $isLinkNode, LinkNode } from "@/app/graph/LinkNode";

type Match = {
  index: number;
  length: number;
  url: string;
  text: string;
};

const COMMON_TLDS = [
  "com",
  "org",
  "gov",
  "edu",
  "network",
  "net",
  "info",
  "ca",
  "uk",
  "de",
  "rs",
  "ru",
  "ir",
  "me",
  "io",
  "app",
  "biz",
  "dev",
  "xyz",
  "asia",
].join("|");

// High confidence links start with the http:// or https:// schemas. We allow any TLD for the high confidence links
// ([a-z0-9\-]+\.)+ matches subdomains and domain
// ([a-z0-9]{2,24}) matches TLD
const HIGH_CONFIDENCE_URL_REGEX = `https?:\\/\\/((([a-z0-9-]+\\.)+([a-z0-9-]{2,24}))|localhost)`;

// Low confidence links (without the schema) are likely typed by the user directly. We only allow the most popular TLDs.
// Otherwise similar to highConfidenceLink.
const LOW_CONFIDENCE_URL_REGEX = `((([a-z0-9-]+\\.)+(?:${COMMON_TLDS}))|localhost)`;

// (:[0-9]+) optional port number
// ([?/](([^\s])*([^.\s,])+)?)? optional path matching after tld/port.
//    - [?/] Must start with a slash or question mark
//    - (([^\s])*([^\.\s,])+)? - Anything after slash is optional, but if not
//                              match all non whitespace characters, do not end
//                              with period or dot or whitespace
const END = `(:[0-9]+)?([?/](([^\\s])*([^.\\s,])+)?)?`;

const URL_REGEX = new RegExp(`(${HIGH_CONFIDENCE_URL_REGEX + END})|(${LOW_CONFIDENCE_URL_REGEX + END})`, "giu");

/** Find all the URL matches in the text */
export const findUrlMatches = (text: string): Match[] => {
  const matches = [];
  let currentMatch = URL_REGEX.exec(text);

  while (currentMatch) {
    const fullMatch = currentMatch[0];
    matches.push({
      index: currentMatch.index,
      length: fullMatch.length,
      url: fullMatch.startsWith("http") ? fullMatch : `https://${fullMatch}`,
      text: fullMatch,
    });

    currentMatch = URL_REGEX.exec(text);
  }

  return matches;
};

/** Convert matches to new Lexical nodes */
const matchesToNodes = (text: string, matches: Match[]): LexicalNode[] => {
  if (!matches.length) return [];

  let currentOffset = 0;
  const nodes = matches.reduce((acc, match) => {
    if (match.index > currentOffset) {
      acc.push(new TextNode(text.slice(currentOffset, match.index)));
    }

    const url = match.text;
    const linkNode = $createLinkNode(url.startsWith("http") ? url : `https://${url}`, url);
    acc.push(linkNode);

    currentOffset = match.index + match.length;
    return acc;
  }, [] as LexicalNode[]);

  if (currentOffset < text.length) {
    nodes.push(new TextNode(text.slice(currentOffset)));
  }

  return nodes;
};

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
