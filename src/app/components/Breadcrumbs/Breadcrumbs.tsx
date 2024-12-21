"use client";
import { ArrowLeft, ChevronRight, Command, Ellipsis, Home, Lock, SquareSplitHorizontal, Unlock, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import React, { useCallback } from "react";

import { useAuth } from "@/app/auth/useAuth";
import { BreadcrumbItem } from "@/app/components/Breadcrumbs/BreadcrumbItem";
import { QuickCaptureIcon } from "@/app/components/Icons/QuickCaptureIcon";
import QuickCapture from "@/app/components/QuickCapture/QuickCapture";
import { SyncStatusIndicator } from "@/app/components/SyncStatus/SyncStatusIndicator";
import { Button } from "@/app/components/UIPrimitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { TreeNode } from "@/app/tree/nodes";
import { Ancestor, getAncestorsAsArray, useSetMainRoot } from "@/app/tree/utils";
import { truncateText, useIsMobile } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";
import { GraphNode } from "@/app/graph/GraphNode";
import {modKeyName, optionKeyName} from "@/app/hotkeys";

import { default as s } from "./Breadcrumbs.module.css";

const MAX_VISIBLE_ITEMS = 4; // For desktop view

type RenderBreadcrumbsProps = {
  treeNode: TreeNode;
  ancestors: Ancestor[];
  handleNavigation: (index: number) => void;
};

const RenderMenuItemContent = (text: string) => (
  <span className={cn({ [s.BlankContent]: !text })}>{truncateText(text || "(blank)", 32)}</span>
);

const RenderBreadcrumbs = observer(({ treeNode, ancestors, handleNavigation }: RenderBreadcrumbsProps) => {
  const isMobile = useIsMobile();
  const totalItems = ancestors.length;

  if (isMobile) {
    // Mobile view (unchanged)
    const firstItem = ancestors[0];
    const middleItems = ancestors.slice(1);

    return (
      <>
        {ancestors.length > 0 && (
          <>
            <BreadcrumbItem
              object={firstItem.object}
              path={firstItem.path}
              index={0}
              handleNavigation={handleNavigation}
            />
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
                      <DropdownMenuItem
                        key={`${ancestor.path}-${ancestor.object.text}`}
                        onSelect={() => handleNavigation(index + 1)}
                      >
                        {RenderMenuItemContent(ancestor.object.text)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </>
        )}
        <BreadcrumbItem
          object={treeNode.object}
          path={treeNode.path}
          index={totalItems}
          isRoot={true}
          handleNavigation={handleNavigation}
        />
      </>
    );
  } else {
    // Desktop view
    if (totalItems <= MAX_VISIBLE_ITEMS) {
      return (
        <>
          {ancestors.map((ancestor, index) => (
            <BreadcrumbItem
              key={`${ancestor.path}-${ancestor.object.text}`}
              object={ancestor.object}
              path={ancestor.path}
              index={index}
              handleNavigation={handleNavigation}
            />
          ))}
          <BreadcrumbItem
            key={`root-${treeNode.object.text}`}
            object={treeNode.object}
            path={treeNode.path}
            index={totalItems}
            isRoot={true}
            handleNavigation={handleNavigation}
          />
        </>
      );
    }

    return (
      <>
        {ancestors.length > 0 && (
          <>
            <BreadcrumbItem
              object={ancestors[0].object}
              path={ancestors[0].path}
              index={0}
              handleNavigation={handleNavigation}
            />
            <ChevronRight size={14} strokeWidth={2} className={s.Separator} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span className={s.Breadcrumb}>
                  <Ellipsis size={14} />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent sideOffset={4}>
                {ancestors.slice(1, -MAX_VISIBLE_ITEMS + 2).map((ancestor, index) => (
                  <DropdownMenuItem
                    key={`${ancestor.path}-${ancestor.object.text}`}
                    onSelect={() => handleNavigation(index + 1)}
                  >
                    {RenderMenuItemContent(ancestor.object.text)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {ancestors.slice(-MAX_VISIBLE_ITEMS + 2).map((ancestor, index) => (
              <BreadcrumbItem
                key={`${ancestor.path}-${ancestor.object.text}`}
                object={ancestor.object}
                path={ancestor.path}
                index={totalItems - MAX_VISIBLE_ITEMS + 2 + index}
                handleNavigation={handleNavigation}
              />
            ))}
          </>
        )}
        <BreadcrumbItem
          key={`root-${treeNode.object.text}`}
          object={treeNode.object}
          path={treeNode.path}
          index={totalItems}
          isRoot={true}
          handleNavigation={handleNavigation}
        />
      </>
    );
  }
});

interface BreadcrumbsProps {
  treeNode: TreeNode;
}

export const Breadcrumbs = observer(function Breadcrumbs({ treeNode }: BreadcrumbsProps) {
  const settingsStore = useSettingsStore();
  const setRoot = useSetMainRoot();
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const user = useUser();
  const auth = useAuth();
  const tree = treeNode.tree;
  const ancestors = getAncestorsAsArray(treeNode);
  const router = useRouter();

  const handleNavigation = useCallback(
    (index: number) => {
      if (index > ancestors.length) return;
      const object = index === ancestors.length ? treeNode.object : ancestors[index].object;
      setRoot(object);
    },
    [treeNode, ancestors, setRoot],
  );

  const handlePublicModeChange = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const newIsPublic = !settingsStore.publicMode;
      settingsStore.setPublicMode(newIsPublic);

      if (tree.selection) {
        const selection = tree.selectionWithNodes;
        const candidates: { object: GraphObject; relationWithParent: GraphRelation }[] = [];

        // Resolving the list of graph objects in currently focused tree nodes
        if (selection?.type === "node") {
          candidates.push(...selection.nodes.map(({ object, relationWithParent }) => ({ object, relationWithParent })));
        } else if (selection?.type === "editor") {
          candidates.push({
            object: selection.treeNode.object,
            relationWithParent: selection.treeNode.relationWithParent,
          });
        }

        if (candidates.length > 0) {
          graphStore.applyCombinedTransaction(
            candidates.map(({ object, relationWithParent }) => ({
              type: "setIsPublic",
              transaction: {
                objectId: object.id,
                relationId: relationWithParent?.id,
                isPublic: newIsPublic,
                alsoSetRelatedObjects: false,
                alsoSetChildrenAndDescendants: false,
                isNewRelatedObjectsPublic: false,
                isChecked: object instanceof GraphNode ? object.isChecked : null
              },
            })),
          );
        }

        if (selection?.type === "editor") {
          tree.setFocusedNode(selection.treeNodeId, selection.position, selection.editMode);
        }
      }
    },
    [graphStore, settingsStore, tree],
  );

  return (
    <>
      <nav className={s.BreadcrumbContainer} aria-label="breadcrumb">
        <Button
          variant="default"
          size="icon"
          className={cn(s.ShowTooltip, s.BottomAlign)}
          data-tooltip="Go back"
          onClick={() => router.back()}
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
        </Button>
        <Button
          variant="default"
          size="icon"
          className={cn(s.ShowTooltip, s.BottomAlign)}
          data-tooltip="Home"
          onClick={() => setRoot(graphStore.getDefaultRootForUser())}
        >
          <Home size={14} strokeWidth={1.5} />
        </Button>
        <div className={s.BreadcrumbWrapper}>
          <RenderBreadcrumbs treeNode={treeNode} ancestors={ancestors} handleNavigation={handleNavigation} />
        </div>
        {viewStore.quickCaptureOpen && <QuickCapture />}
        {!user.isAnonymous ? (
          <div className={s.BreadcrumbRightArea}>
            <Button
              style={{ position: "relative" }}
              variant="default"
              className={cn(s.ShowTooltip, s.BottomAlign)}
              data-tooltip={`Command bar · ` + [`${modKeyName}`,"⇧","K"].join("+")}
              size="icon"
              onClick={() => viewStore.setCommandBarOpen(!viewStore.isCommandBarOpen)}
            >
              <Command size={14} strokeWidth={1.5} />
            </Button>
            <Button
              style={{ position: "relative" }}
              className={cn(s.ShowTooltip, s.RightAlign)}
              data-tooltip={settingsStore.publicMode ? "Public mode" : "Private mode"}
              variant={settingsStore.publicMode ? "active" : "default"}
              size="icon"
              onClick={(event) => handlePublicModeChange(event)}
            >
              {settingsStore.publicMode ? <Unlock size={14} strokeWidth={1.5} /> : <Lock size={14} strokeWidth={1.5} />}
            </Button>
            <Button
              style={{ position: "relative" }}
              className={cn(s.ShowTooltip, s.RightAlign)}
              data-tooltip={viewStore.quickCaptureOpen ? `Close Quick Capture` : (`Open Quick Capture · ` + [`${modKeyName}`,`${optionKeyName}`,"K"].join('+'))}
              variant={"default"}
              size="icon"
              onClick={() => viewStore.quickCaptureOpen ? viewStore.closeQuickCapture(): viewStore.openQuickCaptureAndCreateNode()}
            >
              {viewStore.quickCaptureOpen ? <X size={14} /> : <QuickCaptureIcon />}
            </Button>
            <Button
              style={{ position: "relative" }}
              className={cn(s.ShowTooltip, s.RightAlign)}
              data-tooltip={(viewStore.rightSidebarOpen ? "Close Side Tree View" : "Open Side Tree View") + ` · ` +[`${modKeyName}`,`${optionKeyName}`,"S"].join('+')}
              variant={viewStore.rightSidebarOpen ? "active" : "default"}
              size="icon"
              onClick={() => viewStore.toggleRightSidebar()}
            >
              {viewStore.rightSidebarOpen ? (
                <SquareSplitHorizontal size={14} strokeWidth={1.5} />
              ) : (
                <SquareSplitHorizontal strokeWidth={1.5} size={14} />
              )}
            </Button>
            <SyncStatusIndicator />
          </div>
        ) : (
          <Button variant="active" size="sm" onClick={() => auth?.loginWithRedirect()}>
            Sign in
          </Button>
        )}
      </nav>
    </>
  );
});
