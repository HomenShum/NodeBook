"use client";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { Breadcrumbs } from "@/app/components/Breadcrumbs/Breadcrumbs";
import { ControlsBar } from "@/app/components/ControlsBar/ControlsBar";
import { Tree } from "@/app/tree/Tree";
import { TreeContext } from "@/app/tree/TreeContext";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";
import OutlineContent from "@/app/components/OutlineContent";

import s from "./OutlineView.module.css";

interface Props {
  tree: Tree;
}

export const OutlineView = observer(function OutlineView({ tree }: Props) {
  const viewStore = useViewStore();

  const treeRoot = tree.state.root;

  // Set the tree selection to null when the user clicks outside an editor
  useEffect(() => {
    function clearSelectionOnClickOutsideOutline(e: MouseEvent) {
      const isEditor =
        e.target instanceof HTMLElement &&
        e.target.closest('[data-lexical-editor="true"]') !== null &&
        (e.target.isContentEditable || e.target.tagName === "INPUT");
      if (!isEditor) {
        tree.setFocusedNode(null);
      }
    }
    //Todo: This can be moved to hotkeys?
    const handleClipboardEvent = (e: ClipboardEvent) => {
      if (e.type === "copy") {
        const hasCopied = viewStore.activeTree.copySelectedNodes(e);
        if (hasCopied) e.preventDefault();
      }
    };
    window.addEventListener("click", clearSelectionOnClickOutsideOutline);
    document.addEventListener("copy", handleClipboardEvent);
    return () => {
      window.removeEventListener("click", clearSelectionOnClickOutsideOutline);
      document.removeEventListener("copy", handleClipboardEvent);
    };
  }, [tree, viewStore.activeTree]);

  return (
    <TreeContext.Provider value={tree}>
      <div
        className={cn(s.OutlineView, {
          [s.OutlineViewFull]: !viewStore.leftSidebarOpen,
        })}
      >
        <div className={s.WindowNav}>
          <Breadcrumbs treeNode={treeRoot} />
          <ControlsBar tree={tree} />
        </div>
        <OutlineContent tree={tree} />
      </div>
    </TreeContext.Provider>
  );
});
