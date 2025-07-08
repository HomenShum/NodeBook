import { useEffect, useState } from "react";

import { DescendantTreeNode } from "@/app/tree/nodes";
import { useViewStore } from "@/app/view/useViewStore";

const DEFAULT_PAGINATION_SIZE = 50;

export const usePagination = (nodes: DescendantTreeNode[], pageSize = DEFAULT_PAGINATION_SIZE) => {
  const [ensureInViewIndex, setEnsureInViewIndex] = useState(-1);
  const [startOffset, setStartOffset] = useState(0);
  const [endOffset, setEndOffset] = useState(0);
  const viewStore = useViewStore();

  useEffect(() => {
    if (!viewStore.jumpToNodeId) {
      return;
    }

    setEnsureInViewIndex(nodes.findIndex((node) => node.object.id === viewStore.jumpToNodeId));
    if (ensureInViewIndex !== -1) {
      viewStore.clearJumpToNodeId();
    }
  }, [viewStore.jumpToNodeId, nodes, viewStore, ensureInViewIndex]);

  // Reset the ensureInViewIndex when a new node is added
  useEffect(() => {
    setEnsureInViewIndex(-1);
  }, [nodes.length]);

  // Calculate ideal start and end positions (index in the middle)
  let startNode = Math.max(0, ensureInViewIndex - Math.floor(pageSize / 2));
  let endNode = startNode + pageSize;

  // Adjust if we're too close to the end
  if (endNode > nodes.length) {
    endNode = nodes.length;
    startNode = Math.max(0, endNode - pageSize);
  }

  endNode = Math.min(endNode + endOffset, nodes.length);
  startNode = Math.max(0, startNode - startOffset);

  const loadNext =
    nodes.length > endNode
      ? () => {
          setEndOffset(endOffset + pageSize);
        }
      : undefined;

  const loadPrevious =
    startNode > 0
      ? () => {
          setStartOffset(startOffset + pageSize);
        }
      : undefined;

  return {
    paginatedNodes: nodes.slice(startNode, endNode),
    loadNext,
    loadPrevious,
  };
};
