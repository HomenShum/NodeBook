// Hook for app-level keyboard shortcuts, NOT for keyboard shortcuts triggered within editor. Those are handled in KeyboardOverridesPlugin

import { useCallback, useEffect } from "react";

import { useRenderController } from "@/app/render/useRenderController";
import { relationsToPathStr, useCurView } from "@/app/util";
import { ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";

export const useKeyboardShortcuts = () => {
  const curView = useCurView();
  const viewStore = useViewStore();
  const renderController = useRenderController();
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
    async (e: KeyboardEvent) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows
      // Create note shortcut when it's not already handled by an editor
      if (metaOrCtrl && e.key === "k") {
        e.preventDefault();
        switch (curView) {
          case ViewType.OUTLINE: {
            const { path } = await viewStore.mainOutlineView.createChildNode();
            renderController.setFocusedNode(relationsToPathStr(path));
            break;
          }
          case ViewType.THOUGHTSTREAM:
          case ViewType.SPLIT: {
            const { path } = await viewStore.mainStreamView.createChildNode();
            renderController.setFocusedNode(relationsToPathStr(path));
            break;
          }
          default:
            curView satisfies never;
        }
      }
      if (e.key === "Backspace" && renderController.selectedNodes.length > 1) {
        // TODO: here and elsewhere, want to allow for action on a single selected node but avoid conflict with editor text inputs
        e.preventDefault();
        deleteNodes();
      }
      // Outline-only shortcuts
      if (curView === ViewType.OUTLINE || curView === ViewType.SPLIT) {
        // Indent on tab
        if (!e.shiftKey && e.key === "Tab" && renderController.selectedNodes.length > 1) {
          e.preventDefault();
          indentNodes();
        }
        // Unindent on shift + tab
        if (e.shiftKey && e.key === "Tab" && renderController.selectedNodes.length > 1) {
          e.preventDefault();
          unindentNodes();
        }
      }
    },
    [renderController, curView, viewStore, deleteNodes, indentNodes, unindentNodes],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
