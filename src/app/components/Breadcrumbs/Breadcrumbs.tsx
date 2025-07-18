"use client";
import { ArrowLeft, ChevronRight, Ellipsis, Home } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { BreadcrumbItem } from "@/app/components/Breadcrumbs/BreadcrumbItem";
import BreadcrumbMenu from "@/app/components/Breadcrumbs/BreadcrumbMenu";
import { Button } from "@/app/components/UIPrimitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { GraphObject } from "@/app/graph/GraphObject";
import { getCanonicalPath } from "@/app/graph/utils";
import { TreeNode } from "@/app/tree/nodes";
import { useSetMainRoot } from "@/app/tree/utils";
import { objectPathToObjects, truncateText, useIsMobile } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { default as s } from "./Breadcrumbs.module.css";

const MAX_VISIBLE_ITEMS = 4; // For desktop view

type RenderBreadcrumbsProps = {
  treeNode: TreeNode;
  ancestors: GraphObject[];
  handleNavigation: (index: number) => void;
};

const RenderMenuItemContent = (text: string) => (
  <span className={cn({ [s.BlankContent]: !text })}>{truncateText(text || "(blank)", 32)}</span>
);

const RenderBreadcrumbs = observer(({ treeNode, ancestors, handleNavigation }: RenderBreadcrumbsProps) => {
  const isMobile = useIsMobile();
  const graphStore = useGraphStore();
  const totalItems = ancestors.length;

  const layerObjectIds = useMemo(() => ancestors.map((a) => a.id), [ancestors]);

  // Move loading to useEffect to avoid render-time side effects
  useEffect(() => {
    graphStore.layerManager.loadWithIds(layerObjectIds);
  }, [graphStore.layerManager, layerObjectIds]);

  if (isMobile) {
    // Mobile view (unchanged)
    const firstItem = ancestors[0];
    const middleItems = ancestors.slice(1);

    return (
      <>
        {ancestors.length > 0 && (
          <>
            <BreadcrumbItem object={firstItem} index={0} handleNavigation={handleNavigation} />
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
                      <DropdownMenuItem key={ancestor.id} onSelect={() => handleNavigation(index + 1)}>
                        {RenderMenuItemContent(ancestor.text)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </>
        )}
        <BreadcrumbItem object={treeNode.object} index={totalItems} handleNavigation={handleNavigation} />
      </>
    );
  } else {
    // Desktop view
    if (totalItems <= MAX_VISIBLE_ITEMS) {
      return (
        <>
          {ancestors.map((ancestor, index) => (
            <BreadcrumbItem key={ancestor.id} object={ancestor} index={index} handleNavigation={handleNavigation} />
          ))}
        </>
      );
    }

    return (
      <>
        {ancestors.length > 0 && (
          <>
            <BreadcrumbItem object={ancestors[0]} index={0} handleNavigation={handleNavigation} />
            <ChevronRight size={14} strokeWidth={2} className={s.Separator} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span className={s.Breadcrumb}>
                  <Ellipsis size={14} />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent sideOffset={4}>
                {ancestors.slice(1, -MAX_VISIBLE_ITEMS + 2).map((ancestor, index) => (
                  <DropdownMenuItem key={ancestor.id} onSelect={() => handleNavigation(index + 1)}>
                    {RenderMenuItemContent(ancestor.text)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {ancestors.slice(-MAX_VISIBLE_ITEMS + 2).map((ancestor, index) => (
              <BreadcrumbItem
                key={ancestor.id}
                object={ancestor}
                index={totalItems - MAX_VISIBLE_ITEMS + 2 + index}
                handleNavigation={handleNavigation}
              />
            ))}
          </>
        )}
      </>
    );
  }
});

interface BreadcrumbsProps {
  treeNode: TreeNode;
}

export const Breadcrumbs = observer(function Breadcrumbs({ treeNode }: BreadcrumbsProps) {
  const setRoot = useSetMainRoot();
  const graphStore = useGraphStore();
  const router = useRouter();
  const viewStore = useViewStore();

  const objectPath = useMemo(() => getCanonicalPath(treeNode.object), [treeNode.object]);

  const ancestors = useMemo(() => {
    return objectPathToObjects(objectPath) || [];
  }, [objectPath]);

  const handleNavigation = useCallback(
    (index: number) => {
      if (index > ancestors.length) return;
      const object = index === ancestors.length ? treeNode.object : ancestors[index];
      setRoot(object);
    },
    [treeNode, ancestors, setRoot],
  );

  return (
    <>
      <nav className={s.BreadcrumbContainer} aria-label="breadcrumb">
        <Button
          variant="default"
          size="icon"
          className={cn(s.ShowTooltip, s.BottomAlign)}
          data-tooltip="Go back"
          disabled={!viewStore.canGoBack}
          onClick={() => {
            if (!viewStore.canGoBack) return;

            // Get the current object ID before navigating back
            const currentObjectId = treeNode.object.id;

            // Track back navigation
            viewStore.decrementNavigationDepth();

            router.back();
            // After navigation, restore scroll position
            // We need to wait for the navigation to complete
            setTimeout(() => {
              viewStore.restoreScrollPosition(currentObjectId);
            }, 40); // Race condition :(
          }}
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
        {!viewStore.quickCaptureOpen && <BreadcrumbMenu />}
      </nav>
    </>
  );
});
