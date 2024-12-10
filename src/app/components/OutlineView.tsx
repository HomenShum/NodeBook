"use client";
import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";

import { Breadcrumbs } from "@/app/components/Breadcrumbs/Breadcrumbs";
import { ControlsBar } from "@/app/components/ControlsBar/ControlsBar";
import OutlineContent from "@/app/components/OutlineContent";
import { Tree } from "@/app/tree/Tree";
import { TreeContext } from "@/app/tree/TreeContext";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";
import RightSidebar from "@/app/components/RightSidebar";

import s from "./OutlineView.module.css";

interface Props {
  tree: Tree;
}

export const OutlineView = observer(function OutlineView({ tree }: Props) {
  const viewStore = useViewStore();

  const treeRoot = tree.state.root;

  useEffect(() => {
    //Todo: This can be moved to hotkeys?
    const handleClipboardEvent = (e: ClipboardEvent) => {
      if (e.type === "copy") {
        const hasCopied = viewStore.activeTree.copySelectedNodes(e);
        if (hasCopied) e.preventDefault();
      }
    };
    document.addEventListener("copy", handleClipboardEvent);
    return () => {
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
        <div className={s.MainAndSidebarContainer}>
          <OutlineContent tree={tree} />
          <RightSidebar />
        </div>
      </div>
    </TreeContext.Provider>
  );
});
