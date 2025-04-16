import { TreeNodeContentSelectionPosition } from "./selection";

/**
 * Represents a selection state that can be stored and restored during undo/redo operations.
 *
 * This is used to track and restore selection states when operations like node creation,
 * splitting, indenting, etc. are undone.
 */
export interface SelectionState {
  nodeId: string; // Current node's ID
  previousNodeId: string; // Node to return to on undo
  treeType: string; // Type of tree (e.g., "main")
  editorPath: string; // Full path to editor, accessed via treeNode.id
  operation: "NEW_SIBLING_BELOW_CURRENT" | "REPLACE_RELATION_LINK" | "INDENT" | "DEDENT" | "SPLIT_NOTE";
  position: TreeNodeContentSelectionPosition; // Can be "start" | "end" | { anchorOffset: number; focusOffset: number }
  timestamp: number;
  associatedGraphUpdateIds: string[]; // Links selection state to specific graph updates for undo matching
}

/**
 * Helper functions for selection state management
 */
export const SelectionStateUtils = {
  /**
   * Restore a selection state by selecting the element and setting focus
   *
   * @param state The selection state to restore
   * @returns True if the selection was restored, false otherwise
   */
  restoreSelection: (state: SelectionState): boolean => {
    if (typeof window === "undefined") return false;

    try {
      // First try to find the editor element
      const selector = `[data-editor-path="${state.editorPath}"][data-tree-type="${state.treeType}"]`;
      const editorElement = document.querySelector(selector);

      if (!editorElement) {
        console.debug(`Could not find editor element with selector: ${selector}`);
        return false;
      }

      // Found the element, now focus it
      (editorElement as HTMLElement).focus();
      return true;
    } catch (error) {
      console.error("Error restoring selection:", error);
      return false;
    }
  },
};
