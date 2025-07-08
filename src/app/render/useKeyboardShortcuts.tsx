// Hook for app-level keyboard shortcuts, NOT for keyboard shortcuts triggered within editor. Those are handled in KeyboardOverridesPlugin

import { useCallback, useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { isHelpModalHotkey } from "@/app/hotkeys";
import { useSetMainRoot } from "@/app/tree/utils";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";

export const useKeyboardShortcuts = () => {
  const user = useUser();
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows

      // Toggle help modal shortcut
      if (isHelpModalHotkey(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (viewStore.activeModal === "help") {
          viewStore.setActiveModal(null);
        } else {
          viewStore.setActiveModal("help");
        }
        return;
      }

      // Create note shortcut when it's not already handled by an editor
      if (metaOrCtrl && !e.shiftKey && e.key === "k" && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();

        const { node, path } = await viewStore.activeTree.createChildOfRootAndFocus();
        if (viewStore.isDeepSearching) {
          // Temporarily add it to the search view if we're in search view
          viewStore.searchView.addTempPath(node, path);
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
