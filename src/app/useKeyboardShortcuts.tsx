import { useCallback, useEffect } from "react";
import { Bullet } from "./model/OutlineBullet";
import { Note } from "./model/ThoughtstreamNote";
import { ViewType } from "./model/ViewStore";
import { useViewStore } from "./store/useViewStore";

// Hook for app-level keyboard shortcuts, NOT for keyboard shortcuts triggered within editor. Those are handled in KeyboardOverridesPlugin
export const useKeyboardShortcuts = () => {
  const viewStore = useViewStore();

  const createNode = useCallback(() => {
    if (viewStore.curView === ViewType.OUTLINE) {
      // For outline view, we create a new bullet
      const newBullet = viewStore.outlineViewStore.root!.createChild();
      viewStore.setFocusedNode(newBullet);
      return;
    } else {
      // For both thoughtstream and split view, we create a new note in the thoughtstream
      const newNote = viewStore.thoughtstreamViewStore.createNote();
      viewStore.setFocusedNode(newNote);
      return;
    }
  }, [viewStore]);

  const deleteNodes = useCallback(() => {
    for (const node of viewStore.selectedNodes) {
      if (node.type === "bullet") {
        viewStore.outlineViewStore.deleteBullet(node as Bullet);
      } else if (node.type === "note") {
        viewStore.thoughtstreamViewStore.deleteNote(node as Note);
      }
    }
  }, [viewStore]);

  const indentNodes = useCallback(() => {
    const selectedNodes = Array.from(viewStore.selectedNodes).filter((node) => node.type === "bullet") as Bullet[];
    if (selectedNodes.length === 0) return;

    // TODO: Need to find the set of parent nodes in the selected nodes, and then indent those (and only those) all together.
    // The children of the selected nodes don't need to be updated as their position is defined relative to the parent.
  }, [viewStore]);

  const unindentNodes = useCallback(() => {
    const selectedNodes = Array.from(viewStore.selectedNodes).filter((node) => node.type === "bullet") as Bullet[];
    if (selectedNodes.length === 0) return;

    // TODO: Need to find the set of parent nodes in the selected nodes, and then unindent those (and only those) all together.
    // The children of the selected nodes don't need to be updated as their position is defined relative to the parent.
  }, [viewStore]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows

      // Create note shortcut
      if (metaOrCtrl && e.key === "k") {
        e.preventDefault();
        createNode();
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        deleteNodes();
      }

      // Outline-only shortcuts
      if (viewStore.curView === ViewType.OUTLINE || viewStore.curView === ViewType.SPLIT) {
        if (!e.shiftKey && e.key === "Tab") {
          e.preventDefault();
          indentNodes();
        }
        if (e.shiftKey && e.key === "Tab") {
          e.preventDefault();
          unindentNodes();
        }
      }
    },
    [viewStore, createNode, deleteNodes, indentNodes, unindentNodes],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
