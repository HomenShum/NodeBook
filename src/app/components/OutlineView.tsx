"use client";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import appStyles from "@/app/app.module.css";
import { Breadcrumbs } from "@/app/components/Breadcrumbs/Breadcrumbs";
import { ControlsBar } from "@/app/components/ControlsBar/ControlsBar";
import GraphContainer from "@/app/components/GraphView/GraphContainer";
import OutlineContent from "@/app/components/OutlineContent";
import { PageTitleUpdater } from "@/app/components/PageTitleUpdater";
import QuickCapture from "@/app/components/QuickCapture/QuickCapture";
import RightSidebar from "@/app/components/RightSidebar/RightSidebar";
import { Tree } from "@/app/tree/Tree";
import { TreeContext } from "@/app/tree/TreeContext";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";
import { OutlineParentContext } from "@/app/contexts/OutlineContentContext";

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
        className={cn(appStyles.ViewContainer, {
          [appStyles.ViewContainerFull]: !viewStore.leftSidebarOpen,
        })}
      >
        <PageTitleUpdater tree={tree} />
        <QuickCapture />
        <div className={s.WindowNav}>
          <Breadcrumbs treeNode={treeRoot} />
          <ControlsBar tree={tree} />
        </div>
        {viewStore.graphMode ? (
          <GraphContainer tree={tree} />
        ) : (
          <div className={s.MainAndSidebarContainer}>
            <OutlineParentContext.Provider value="OutlineView">
              <OutlineContent tree={tree} />
            </OutlineParentContext.Provider>
            <RightSidebar minWidth={300} maxWidth={600} />
          </div>
        )}
      </div>
    </TreeContext.Provider>
  );
});
