import { useCallback } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";

export const useClickableMention = (treeNode: DescendantTreeNode | RootTreeNode) => {
  const graphStore = useGraphStore();
  const tree = treeNode.tree;

  return useCallback(
    (e: Event) => {
      e.stopPropagation();

      const nodeId = (e.target as HTMLElement).getAttribute("data-lexical-mentioned-graph-node-id")!;
      const node = graphStore.getNode(nodeId);
      const isTopLevelExpanded = tree.isPathExpanded(treeNode.path) || treeNode instanceof RootTreeNode;

      if (node) {
        if (!isTopLevelExpanded && treeNode instanceof DescendantTreeNode) {
          tree.togglePathExpanded(treeNode.path);
        }

        // Find the tree node for the mention that is clicked, among the children of the current node
        const mentionTreeNode = treeNode.childrenGroupsById.all.nodes.find(({ object }) => {
          return object.id === node.id;
        });

        if (mentionTreeNode) {
          if (!isTopLevelExpanded) {
            tree.setPathExpanded(mentionTreeNode.path, true); // If we just expanded the top level
          } else {
            tree.togglePathExpanded(mentionTreeNode.path); // If the top level is already expanded
          }
        }
      }
    },
    [graphStore, treeNode, tree],
  );
};
