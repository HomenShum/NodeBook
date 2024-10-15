// Hook for app-level keyboard shortcuts, NOT for keyboard shortcuts triggered within editor. Those are handled in KeyboardOverridesPlugin

import { useCallback, useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { useSetRoot } from "@/app/tree/utils";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";

export const useKeyboardShortcuts = () => {
  const user = useUser();
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const setRoot = useSetRoot();
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows
      // Create note shortcut when it's not already handled by an editor
      if (metaOrCtrl && !e.shiftKey && e.key === "k") {
        e.preventDefault();
        await viewStore.mainView.createChildOfRootAndFocus();
      }
      if (metaOrCtrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          graphStore.updateManager.redo();
        } else {
          graphStore.updateManager.undo();
        }
      }
      if (metaOrCtrl && e.shiftKey && e.key === "b") {
        e.preventDefault();
        viewStore.toggleLeftSidebar();
      }
      if (metaOrCtrl && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setRoot(graphStore.getDefaultRootForUser());
        viewStore.setViewType(ViewType.Note);
      }
    },
    [viewStore, graphStore, setRoot],
  );
  useEffect(() => {
    if (!user.isAnonymous) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [user, handleKeyDown]);
};
