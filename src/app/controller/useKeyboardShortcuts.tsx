// Hook for app-level keyboard shortcuts, NOT for keyboard shortcuts triggered within editor. Those are handled in KeyboardOverridesPlugin

import { useCallback, useEffect } from "react";
import { ViewType } from "./ViewController";
import { useViewController } from "./useViewController";

export const useKeyboardShortcuts = () => {
  const viewController = useViewController();

  const createNode = useCallback(() => {
    viewController.createAndFocusChildNode();
  }, [viewController]);

  const deleteNodes = useCallback(() => {
    // TODO
  }, []);

  const indentNodes = useCallback(() => {
    // TODO: Need to find the set of parent nodes in the selected nodes, and then indent those (and only those) all together.
    // The children of the selected nodes don't need to be updated as their position is defined relative to the parent.
  }, []);

  const unindentNodes = useCallback(() => {
    // TODO: Need to find the set of parent nodes in the selected nodes, and then unindent those (and only those) all together.
    // The children of the selected nodes don't need to be updated as their position is defined relative to the parent.
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows

      // Create note shortcut
      if (metaOrCtrl && e.key === "k") {
        e.preventDefault();
        createNode();
      }

      if (e.key === "Backspace" && viewController.selectedNodes.length > 1) {
        // TODO: here and elsewhere, want to allow for action on a single selected node but avoid conflict with editor text inputs
        e.preventDefault();
        deleteNodes();
      }

      // Outline-only shortcuts
      if (viewController.curView === ViewType.OUTLINE || viewController.curView === ViewType.SPLIT) {
        // Indent on tab
        if (!e.shiftKey && e.key === "Tab" && viewController.selectedNodes.length > 1) {
          e.preventDefault();
          indentNodes();
        }
        // Unindent on shift + tab
        if (e.shiftKey && e.key === "Tab" && viewController.selectedNodes.length > 1) {
          e.preventDefault();
          unindentNodes();
        }
      }
    },
    [viewController, createNode, deleteNodes, indentNodes, unindentNodes],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
