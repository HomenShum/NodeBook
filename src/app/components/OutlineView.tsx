"use client";
import {
  ChevronRight,
  ChevronsDownUp,
  Ellipsis,
  Globe,
  ListIcon,
  NetworkIcon,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import appStyles from "@/app/app.module.css";
import AiSearchSidebar from "@/app/components/AiSearchSidebar/AiSearchSidebar";
import { BreadcrumbItem } from "@/app/components/Breadcrumbs/BreadcrumbItem";
import { Breadcrumbs } from "@/app/components/Breadcrumbs/Breadcrumbs";
import { ControlsBar } from "@/app/components/ControlsBar/ControlsBar";
import { ExpandLineArrowsIcon, NotesIcon } from "@/app/components/CustomIcons";
import GraphContainer from "@/app/components/GraphView/GraphContainer";
import OutlineContent from "@/app/components/OutlineContent";
import { PageTitleUpdater } from "@/app/components/PageTitleUpdater";
import QuickCapture from "@/app/components/QuickCapture/QuickCapture";
import RightSidePanel from "@/app/components/RightSidePanel/RightSidePanel";
import { Button } from "@/app/components/UIPrimitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import Loader from "@/app/components/UIPrimitives/Loader";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useLoading } from "@/app/contexts/LoadingContext";
import { OutlineParentContext } from "@/app/contexts/OutlineContentContext";
import { useUser } from "@/app/contexts/UserContext";
import { AccessMode, GraphNode } from "@/app/graph/GraphNode";
import { getCanonicalPath } from "@/app/graph/utils";
import { useToast } from "@/app/hooks/useToast";
import { Tree } from "@/app/tree/Tree";
import { TreeContext } from "@/app/tree/TreeContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { objectPathToObjects, useIsMobile } from "@/app/util";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";
import { GLOBAL_ROOT_ID } from "@/lib/constants";

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
  const isSmallScreen = useIsMobile(600);
  const isMobileSize = useIsMobile(800);
  const allowAnonymousAppend = treeRoot.object instanceof GraphNode && treeRoot.object.accessMode === AccessMode.APPEND;
  const objectPath = useMemo(() => getCanonicalPath(treeRoot.object), [treeRoot.object]);

  const ancestors = useMemo(() => {
    return objectPathToObjects(objectPath) || [];
  }, [objectPath]);

  const handleBreadcrumbNavigation = useCallback(
    (index: number) => {
      if (index > ancestors.length) return;
      const object = index === ancestors.length ? treeRoot.object : ancestors[index];
      setRoot(object);
    },
    [treeRoot, ancestors, setRoot],
  );

  const renderBreadcrumbsForMiddleRow = () => {
    const isMobile = isSmallScreen;
    const totalItems = ancestors.length;

    if (isMobile) {
      // Mobile view
      const firstItem = ancestors[0];
      const middleItems = ancestors.slice(1);

      return (
        <>
          {ancestors.length > 0 && (
            <>
              <BreadcrumbItem object={firstItem} index={0} handleNavigation={handleBreadcrumbNavigation} />
              {middleItems.length > 0 && (
                <>
                  <ChevronRight size={14} strokeWidth={2} className={s.Separator} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <span className={s.Breadcrumb}>
                        <Ellipsis size={14} />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={4}>
                      {middleItems.map((ancestor, index) => (
                        <DropdownMenuItem key={ancestor.id} onSelect={() => handleBreadcrumbNavigation(index + 1)}>
                          {ancestor.text || "(blank)"}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </>
          )}
          {treeRoot.object.id !== GLOBAL_ROOT_ID && (
            <BreadcrumbItem object={treeRoot.object} index={totalItems} handleNavigation={handleBreadcrumbNavigation} />
          )}
        </>
      );
    }
    return null;
  };

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

  const setViewType = (viewType: ViewType): void => {
    viewStore.setViewType(viewType);
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
          {isSmallScreen && (
            <div className={s.MiddleRow}>
              <div className={s.MiddleRowBlock}>
                <div className={s.BreadcrumbContentForMiddleRow}>{renderBreadcrumbsForMiddleRow()}</div>
              </div>
              <div className={s.MiddleRowBlock}>
                {/* Expansion Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size={isMobileSize ? "icon" : "sm"}>
                      <ExpandLineArrowsIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => {
                        tree.collapseAllNodes();
                        addToast({
                          title: "All nodes collapsed",
                          duration: 4000,
                        });
                      }}
                    >
                      <ChevronsDownUp size={14} strokeWidth={1.5} />
                      Collapse all
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={async () => {
                        const success = await tree.saveExpansionStateForAllUsers();
                        if (success) {
                          addToast({
                            title: "Expansion state saved for all users",
                            duration: 4000,
                          });
                        } else {
                          addToast({
                            title: "Failed to save expansion state",
                            duration: 4000,
                          });
                        }
                      }}
                    >
                      <Save size={14} strokeWidth={1.5} />
                      Save current state
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        const success = await tree.applySavedExpansionState();
                        if (success) {
                          addToast({
                            title: "Saved expansion state applied",
                            duration: 4000,
                          });
                        } else {
                          addToast({
                            title: "No saved expansion state found",
                            duration: 4000,
                          });
                        }
                      }}
                    >
                      <RotateCcw size={14} strokeWidth={1.5} />
                      Apply saved state
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* ViewType Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm">
                      {viewStore.viewType === ViewType.Graph ? (
                        <NetworkIcon size={14} strokeWidth={1.5} />
                      ) : viewStore.viewType === ViewType.Outline ? (
                        <ListIcon size={17} strokeWidth={1.8} />
                      ) : viewStore.viewType === ViewType.Webpage ? (
                        <Globe size={14} strokeWidth={1.5} />
                      ) : (
                        <NotesIcon />
                      )}
                      <span>
                        {viewStore.viewType === ViewType.Graph
                          ? "Graph View"
                          : viewStore.viewType === ViewType.Outline
                            ? "List View"
                            : viewStore.viewType === ViewType.Note
                              ? "Note View"
                              : viewStore.viewType === ViewType.Webpage
                                ? "Webpage View"
                                : "Card View"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setViewType(ViewType.Outline)}>
                      <ListIcon size={17} strokeWidth={1.7} />
                      List View
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setViewType(ViewType.Note)}>
                      <NotesIcon />
                      Note View
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setViewType(ViewType.Card)}>
                      <NotesIcon />
                      Card View
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setViewType(ViewType.Webpage)}>
                      <Globe size={14} strokeWidth={1.5} />
                      Webpage View
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setViewType(ViewType.Graph)}>
                      <NetworkIcon size={14} strokeWidth={1.5} />
                      Graph View
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
          <ControlsBar tree={tree} />
        </div>
        {isLoading ? (
          <Loader />
        ) : viewStore.viewType === ViewType.Graph ? (
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
                    if (isMobileSize && viewStore.quickCaptureOpen) {
                      viewStore.quickCaptureView.createChildOfRootAndFocus();
                      return;
                    }
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
