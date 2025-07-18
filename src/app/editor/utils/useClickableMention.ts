import { useCallback } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { NewUserHint } from "@/app/graph/SettingsStore";
import { useDoubleClick } from "@/app/hooks/useDoubleClick";
import { useToast } from "@/app/hooks/useToast";
import { modKeyName } from "@/app/hotkeys";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";

export const useClickableMention = (treeNode: DescendantTreeNode | RootTreeNode) => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const { addToast } = useToast();
  const settingsStore = useSettingsStore();
  const setRoot = useSetMainRoot();
  const tree = treeNode.tree;

  const handleSingleClick = useCallback(
    (e: any) => {
      const nodeId = (e.target as HTMLElement).getAttribute("data-lexical-mentioned-graph-node-id")!;
      const node = graphStore.getNode(nodeId);
      const isTopLevelExpanded = tree.isPathExpanded(treeNode.path) || treeNode instanceof RootTreeNode;
      const ctrlKey = e.ctrlKey || e.metaKey;

      if (node) {
        // Handle keyboard modifiers (shift or ctrl/cmd)
        if (e.shiftKey) {
          tree.setFocusedNode(null); // Clear the focused node to prevent text selection
          e.preventDefault();
          e.stopPropagation();
          viewStore.createSidePanelTree(node);
          return;
        }

        if (ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          setRoot(node);
          return;
        }

        // Special case for non-mainTree
        if (!tree.isMainTree) {
          setRoot(node);
          return;
        }

        if (!isTopLevelExpanded && treeNode instanceof DescendantTreeNode) {
          tree.togglePathExpanded(treeNode.path);
        }

        // Find the tree node for the mention that is clicked, among the children of the current node
        const mentionTreeNode = treeNode.childrenGroupsById.all.nodes.find(({ object }) => {
          return object.id === node.id;
        });

        if (mentionTreeNode) {
          if (settingsStore.newUserHints.has(NewUserHint.CtrlClickToExpandInlineRelation)) {
            addToast({
              title: `${modKeyName} + click to zoom into the referenced object`,
              description: `Did you mean to zoom into the referenced object? If so, please do ${modKeyName} + click.`,
              action: {
                label: "Don't show again",
                onClick: () => {
                  settingsStore.removeNewUserHint(NewUserHint.CtrlClickToExpandInlineRelation);
                },
              },
            });
          }

          if (!isTopLevelExpanded) {
            tree.setPathExpanded(mentionTreeNode.path, true); // If we just expanded the top level
          } else {
            tree.togglePathExpanded(mentionTreeNode.path); // If the top level is already expanded
          }
        } else {
          addToast({
            title: "Disconnected inline relation",
            description:
              "The inline relation is referring to an object that's either hidden or disconnected from this node. Do you want to jump to it?",
            action: {
              label: "Jump to node",
              onClick: () => {
                setRoot(node);
              },
            },
          });
        }
      } else {
        addToast({
          title: "Mention not found",
          description: "The mentioned node was not found in the graph.",
        });
      }
    },
    [graphStore, viewStore, tree, treeNode, addToast, setRoot],
  );

  const handleDoubleClick = (e: any) => {
    // No-op on double click, allow RelatedNodeView render to handle event
  };

  return useDoubleClick({ onSingleClick: handleSingleClick, onDoubleClick: handleDoubleClick });
};
