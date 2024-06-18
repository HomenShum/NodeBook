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
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows
      // Create note shortcut when it's not already handled by an editor
      if (metaOrCtrl && e.key === "k") {
        e.preventDefault();
        switch (curView) {
          case ViewType.OUTLINE: {
            const { path } = viewStore.mainOutlineView.createChildNode();
            renderController.setFocusedNode(relationsToPathStr(path));
            break;
          }
          case ViewType.THOUGHTSTREAM:
          case ViewType.SPLIT: {
            const { path } = viewStore.mainStreamView.createChildNode();
            renderController.setFocusedNode(relationsToPathStr(path));
            break;
          }
          default:
            curView satisfies never;
        }
      }
    },
    [renderController, curView, viewStore],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
