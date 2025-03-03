// Hook for app-level keyboard shortcuts, NOT for keyboard shortcuts triggered within editor. Those are handled in KeyboardOverridesPlugin

import { useCallback, useEffect } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { useToast } from "@/app/hooks/useToast";
import { useSetMainRoot } from "@/app/tree/utils";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";

export const useKeyboardShortcuts = () => {
  const user = useUser();
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();
  const { addToast } = useToast();

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows
      // Create note shortcut when it's not already handled by an editor
      if (metaOrCtrl && !e.shiftKey && e.key === "k" && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();

        if (viewStore.isDeepSearching) {
          // Show toast notification when in deep searching mode
          addToast({
            title: "Cannot see new nodes in search mode",
            description: "Cannot see new nodes created with Cmd+K in search mode",
            duration: 5000,
          });
        } else {
          await viewStore.activeTree.createChildOfRootAndFocus();
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
    [viewStore, graphStore, setRoot, addToast],
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
