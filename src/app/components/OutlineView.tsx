"use client";
import { Plus } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import appStyles from "@/app/app.module.css";
import { Breadcrumbs } from "@/app/components/Breadcrumbs/Breadcrumbs";
import { ControlsBar } from "@/app/components/ControlsBar/ControlsBar";
import GraphContainer from "@/app/components/GraphView/GraphContainer";
import OutlineContent from "@/app/components/OutlineContent";
import { PageTitleUpdater } from "@/app/components/PageTitleUpdater";
import QuickCapture from "@/app/components/QuickCapture/QuickCapture";
import RightSidePanel from "@/app/components/RightSidePanel/RightSidePanel";
import Loader from "@/app/components/UIPrimitives/Loader";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useLoading } from "@/app/contexts/LoadingContext";
import { OutlineParentContext } from "@/app/contexts/OutlineContentContext";
import { useUser } from "@/app/contexts/UserContext";
import { AccessMode, GraphNode } from "@/app/graph/GraphNode";
import { useToast } from "@/app/hooks/useToast";
import { Tree } from "@/app/tree/Tree";
import { TreeContext } from "@/app/tree/TreeContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";
import AiSearchSidebar from "@/app/components/AiSearchSidebar/AiSearchSidebar";

import s from "./OutlineView.module.css";

interface Props {
  tree: Tree;
}

export const OutlineView = observer(function OutlineView({ tree }: Props) {
  const user = useUser();
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const isLoading = useLoading();
  const ref = useRef<HTMLDivElement>(null);
  const treeRoot = tree.state.root;
  const { addToast } = useToast();
  const setRoot = useSetMainRoot();
  const allowAnonymousAppend = treeRoot.object instanceof GraphNode && treeRoot.object.accessMode === AccessMode.APPEND;

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

  const createAndZoomIntoNewNode = async () => {
    const { node: newNode } = await graphStore.addChildNode({
      parentId: graphStore.userRootId,
      nodeProps: {
        content: [{ type: "text", value: "" }],
      },
    });
    if (tree.isMainTree) {
      setRoot(newNode);
    } else {
      tree.setRoot(newNode);
    }
  };

  return (
    <TreeContext.Provider value={tree}>
      <div
        className={cn(appStyles.ViewContainer, {
          [appStyles.ViewContainerFull]: !viewStore.leftSidebarOpen,
        })}
      >
        <PageTitleUpdater tree={tree} />
        {!isLoading && <QuickCapture />}
        <div className={s.WindowNav}>
          <Breadcrumbs treeNode={treeRoot} />
          <ControlsBar tree={tree} />
        </div>
        {isLoading ? (
          <Loader />
        ) : viewStore.graphMode ? (
          <GraphContainer tree={tree} />
        ) : (
          <div className={s.MainAndSidebarContainer} ref={ref}>
            <OutlineParentContext.Provider value="OutlineView">
              <OutlineContent tree={tree} />
              {(!user.isAnonymous || allowAnonymousAppend) && (
                <button
                  className={s.FloatingActionButton}
                  onClick={(e) => {
                    e.preventDefault();
                    createAndZoomIntoNewNode().catch((error) => {
                      console.error("Failed to create and zoom into new node:", error);
                      addToast({
                        title: "Error",
                        description: "Failed to create and zoom into new node",
                      });
                    });
                  }}
                  title="Create and zoom into new node"
                >
                  <Plus size={24} />
                </button>
              )}
            </OutlineParentContext.Provider>
            <AiSearchSidebar />
            <RightSidePanel parentRef={ref} />
          </div>
        )}
      </div>
    </TreeContext.Provider>
  );
});
