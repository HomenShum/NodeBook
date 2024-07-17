// Hook for app-level keyboard shortcuts, NOT for keyboard shortcuts triggered within editor. Those are handled in KeyboardOverridesPlugin

import { useCallback, useEffect } from "react";

import { useCurView } from "@/app/util";
import { ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";

export const useKeyboardShortcuts = () => {
  const curView = useCurView();
  const viewStore = useViewStore();
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows
      // Create note shortcut when it's not already handled by an editor
      if (metaOrCtrl && e.key === "k") {
        e.preventDefault();
        switch (curView) {
          case ViewType.OUTLINE: {
            await viewStore.mainOutlineView.createChildOfRootAndFocus();
            break;
          }
          case ViewType.THOUGHTSTREAM: {
            await viewStore.mainStreamView.createChildOfRootAndFocus();
            break;
          }
          case ViewType.SPLIT: {
            if (viewStore.focusedView() === ViewType.OUTLINE) {
              await viewStore.mainOutlineView.createChildOfRootAndFocus();
            } else {
              await viewStore.mainStreamView.createChildOfRootAndFocus();
            }
            break;
          }
          default: {
            curView satisfies never;
          }
        }
      }
    },
    [curView, viewStore],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
