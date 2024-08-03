// Hook for app-level keyboard shortcuts, NOT for keyboard shortcuts triggered within editor. Those are handled in KeyboardOverridesPlugin

import { useCallback, useEffect } from "react";

import { useGraphStore } from "@/app/graph/useGraphStore";
import { useCurView } from "@/app/util";
import { ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";

export const useKeyboardShortcuts = () => {
  const curView = useCurView();
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows
      // Create note shortcut when it's not already handled by an editor
      if (metaOrCtrl && !e.shiftKey && e.key === "k") {
        e.preventDefault();
        switch (curView) {
          case ViewType.GRAPH: {
            await viewStore.mainOutlineView.createChildOfRootAndFocus();
            break;
          }
          case ViewType.STREAM: {
            await viewStore.mainStreamView.createChildOfRootAndFocus();
            break;
          }
          default: {
            curView satisfies never;
          }
        }
      }
      if (metaOrCtrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          graphStore.updateManager.redo();
        } else {
          graphStore.updateManager.undo();
        }
      }
    },
    [curView, viewStore, graphStore],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
