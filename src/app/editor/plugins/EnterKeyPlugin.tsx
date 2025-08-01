import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, INSERT_LINE_BREAK_COMMAND, KEY_ENTER_COMMAND } from "lexical";
import { action } from "mobx";
import { useCallback, useEffect } from "react";

import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip } from "@/app/graph/GraphNode";
import { useToast } from "@/app/hooks/useToast";
import { DescendantTreeNode, PointerTreeNode, RootTreeNode, TreeNode } from "@/app/tree/nodes";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";
import { TreeNodeContentSelectionPosition } from "@/app/tree/selection";
import { SelectionState } from "@/app/tree/SelectionState";
import { Tree } from "@/app/tree/Tree";
import { isNoteContent } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";

export function useHandleEnterKey(tree: Tree, treeNode: TreeNode) {
  const { addToast } = useToast();
  const viewStore = useViewStore();

  return useCallback(
    (e: KeyboardEvent, chips?: { before: Chip[]; after: Chip[] }, newPosition?: number) => {
      console.log("Received handleEnterKey with new position", newPosition);
      if (e.key !== "Enter") return false;
      e.preventDefault();
      e.stopPropagation();
      const viewType =
        treeNode.tree instanceof QuickCaptureTree || treeNode.tree instanceof QuickCaptureSearchTree
          ? viewStore.quickCaptureViewType
          : viewStore.viewType;
      const nodeIsNoteContent = isNoteContent(treeNode);
      const isMod = e.metaKey || e.ctrlKey;

      // Create selection state to track before operation
      const createSelectionState = (operation: SelectionState["operation"]) => {
        // Determine which tree we're in
        let treeType = "main";
        if (treeNode.tree instanceof QuickCaptureTree || treeNode.tree instanceof QuickCaptureSearchTree) {
          treeType = "quickCapture";
        } else if (viewStore.sidePanelTrees.includes(treeNode.tree)) {
          treeType = treeNode.tree.id;
        }

        // Get the current position from the tree's selection
        let position: TreeNodeContentSelectionPosition = "start";
        if (treeNode.tree.selection?.type === "editor" && treeNode.tree.selection.treeNodeId === treeNode.path) {
          position = treeNode.tree.selection.position;
        }

        // Create the selection state
        const selectionState: SelectionState = {
          nodeId: treeNode.object.id,
          previousNodeId: treeNode.object.id, // For enter key, we return to same node
          treeType,
          editorPath: treeNode.path,
          operation,
          position, // Use the actual position instead of hardcoding "start"
          timestamp: Date.now(),
          associatedGraphUpdateIds: [], // This field is no longer used with the transaction approach
        };

        return selectionState;
      };

      try {
        //Todo: This can be cleaned up
        if (isMod || treeNode.object.isEditRestricted) {
          if (nodeIsNoteContent && treeNode instanceof DescendantTreeNode) {
            if (chips && chips.after.length === 0 && chips.before.length > 0) {
              // Create a selection state for tracking
              const selState = createSelectionState("NEW_SIBLING_BELOW_CURRENT");

              // Mark that the next update will have selection state
              const updateManager = tree.getUpdateManager();
              if (updateManager) {
                updateManager.nextUpdateHasSelectionState = true;
              }

              // Perform the operation
              tree
                .createChildNode({
                  parent: tree.root,
                  after: -1,
                })
                .then((newNode) => {
                  // Get the transaction ID and track the selection state
                  const updateManager = tree.getUpdateManager();
                  if (updateManager?.lastTransactionId) {
                    const transactionId = updateManager.lastTransactionId;
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("track-selection-state", {
                          detail: {
                            selectionState: selState,
                            transactionId,
                          },
                        }),
                      );
                    }
                  }
                });

              return true;
            }

            // Create selection state for tracking
            const selState = createSelectionState("SPLIT_NOTE");

            // Mark that the next update will have selection state
            const updateManager = tree.getUpdateManager();
            if (updateManager) {
              updateManager.nextUpdateHasSelectionState = true;
            }

            // Perform the operation
            tree.splitNote(treeNode, chips);

            // Get the transaction ID and track the selection state
            if (updateManager?.lastTransactionId) {
              const transactionId = updateManager.lastTransactionId;
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("track-selection-state", {
                    detail: {
                      selectionState: selState,
                      transactionId,
                    },
                  }),
                );
              }
            }

            return true;
          } else {
            // Create selection state for tracking
            const selState = createSelectionState("NEW_SIBLING_BELOW_CURRENT");

            // Mark that the next update will have selection state
            const updateManager = tree.getUpdateManager();
            if (updateManager) {
              updateManager.nextUpdateHasSelectionState = true;
            }
            // Perform the operation
            tree.split(treeNode, chips);

            // Get the transaction ID and track the selection state
            if (updateManager?.lastTransactionId) {
              const transactionId = updateManager.lastTransactionId;
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("track-selection-state", {
                    detail: {
                      selectionState: selState,
                      transactionId,
                    },
                  }),
                );
              }
            }

            return true;
          }
        }

        const childOfTreeRoot = treeNode.parent instanceof RootTreeNode;
        if (
          !nodeIsNoteContent &&
          viewType === "note" &&
          childOfTreeRoot &&
          treeNode instanceof DescendantTreeNode &&
          treeNode.relationWithParent.relationType.label !== "child"
        ) {
          // Create selection state for tracking
          const selState = createSelectionState("NEW_SIBLING_BELOW_CURRENT");

          // Mark that the next update will have selection state
          const updateManager = tree.getUpdateManager();
          if (updateManager) {
            updateManager.nextUpdateHasSelectionState = true;
          }

          // Perform the operation
          tree.convertToNote(treeNode, true);

          // Get the transaction ID and track the selection state
          if (updateManager?.lastTransactionId) {
            const transactionId = updateManager.lastTransactionId;
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("track-selection-state", {
                  detail: {
                    selectionState: selState,
                    transactionId,
                  },
                }),
              );
            }
          }

          return true;
        }

        if (!nodeIsNoteContent && ((viewType === "note" && childOfTreeRoot) || e.shiftKey)) {
          // Create selection state for tracking
          const selState = createSelectionState("SPLIT_NOTE");

          // Mark that the next update will have selection state
          const updateManager = tree.getUpdateManager();
          if (updateManager) {
            updateManager.nextUpdateHasSelectionState = true;
          }

          // Perform the operation
          tree.splitIntoNote(treeNode, chips);

          // Get the transaction ID and track the selection state
          if (updateManager?.lastTransactionId) {
            const transactionId = updateManager.lastTransactionId;
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("track-selection-state", {
                  detail: {
                    selectionState: selState,
                    transactionId,
                  },
                }),
              );
            }
          }

          return true;
        }

        if (treeNode instanceof PointerTreeNode) {
          addToast({
            title: "Cannot split while sublists are flattened",
          });
          return false;
        }

        // Create selection state for tracking
        const selState = createSelectionState("NEW_SIBLING_BELOW_CURRENT");

        // Mark that the next update will have selection state
        const updateManager = tree.getUpdateManager();
        if (updateManager) {
          updateManager.nextUpdateHasSelectionState = true;
        }

        // Perform the operation
        console.log("Calling split with new position", newPosition);
        tree.split(
          treeNode,
          chips,
          newPosition !== undefined ? { anchorOffset: newPosition, focusOffset: newPosition } : undefined,
        );

        // Get the transaction ID and track the selection state
        if (updateManager?.lastTransactionId) {
          const transactionId = updateManager.lastTransactionId;
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("track-selection-state", {
                detail: {
                  selectionState: selState,
                  transactionId,
                },
              }),
            );
          }
        }

        return true;
      } catch (error) {
        console.error("Error during enter key operation:", error);
        return false;
      }
    },
    [treeNode, tree, addToast, viewStore],
  );
}

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const EnterKeyPlugin = ({ treeNode }: { treeNode: TreeNode }) => {
  const [editor] = useLexicalComposerContext();
  const tree = treeNode.tree;
  const handleEnterKey = useHandleEnterKey(tree, treeNode);
  const settingsStore = useSettingsStore();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      action((event) => {
        if (!event) return false;

        // Handle Alt+Enter by inserting a line break
        if (event.altKey) {
          editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
          return true;
        }

        const selection = $getSelection();
        if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;
        const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);

        // Check if we should continue bullet points for new users
        if (settingsStore.newUser && chipsBefore.length > 0) {
          // Check if the content before cursor starts with " *•  " pattern
          const beforeText = chipsBefore.map((chip) => (chip.type === "text" ? chip.value : "")).join("");

          // Match pattern: starts with " *•  " (space, asterisk, bullet, two spaces)
          const bulletPattern = /^ *\t*• *\t/;
          const match = bulletPattern.exec(beforeText);
          if (match) {
            // Add the same bullet pattern to the beginning of the new line
            const bulletChip: Chip = {
              type: "text",
              value: match[0],
            };

            chipsAfter.unshift(bulletChip);
            console.log("Called handleEnterKey with new position", match[0].length);
            return handleEnterKey(event, { before: chipsBefore, after: chipsAfter }, match[0].length);
          }
        }

        return handleEnterKey(event, { before: chipsBefore, after: chipsAfter });
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, handleEnterKey, settingsStore]);

  return null;
};
