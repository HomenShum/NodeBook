import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

import { useViewStore } from '@/app/view/useViewStore';

const OBSERVER_CONFIG = { subtree: true, childList: true };

const getTextNodes = (node: Node) => {
  const treeWalker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const allTextNodes: Node[] = [];
  let currentNode = treeWalker.nextNode();
  while (currentNode) {
    allTextNodes.push(currentNode);
    currentNode = treeWalker.nextNode();
  }

  return allTextNodes;
}


const highlightText = (searchQuery: string, rootElement: Node) => {
  const query = searchQuery.trim().toLowerCase();
  const textNodes = getTextNodes(rootElement);

  const ranges = textNodes
    .map((el) => {
      const nodeText = el.textContent?.toLowerCase() ?? ""
      const indices = [];
      let startPos = 0;
      while (startPos < query.length) {
        const index = nodeText.indexOf(query, startPos);
        if (index === -1) {
          break;
        }
        indices.push(index);
        startPos = index + query.length;
      }

      return indices.map((index) => {
        const range = new Range();
        range.setStart(el, index);
        range.setEnd(el, index + query.length);
        return range;
      });
    });

  const highlight = CSS.highlights.get("text-highlights");
  if (highlight) {
    ranges.flat().forEach((range) => {
      highlight.add(range);
    });
    CSS.highlights.set("text-highlights", highlight);
  }

}

export const SearchQueryHighlightPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { searchQuery } = useViewStore();
  const rootElement = editor.getRootElement();

  useEffect(() => {
    // todo: after build, the rootElement is often null for initial render. Worth to check that later
    if (!searchQuery || !rootElement) {
      return;
    }

    const observer = new MutationObserver(() => {
      highlightText(searchQuery, rootElement);
    });
    observer.observe(rootElement, OBSERVER_CONFIG);

    highlightText(searchQuery, rootElement);

    return () => {
      observer.disconnect();
    };
  }, [editor, searchQuery, rootElement]);

  return null;
};