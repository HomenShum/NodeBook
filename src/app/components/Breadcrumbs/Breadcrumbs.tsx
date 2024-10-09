"use client";
import { ChevronRight, Ellipsis, Lock, Unlock } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useMemo } from "react";

import { BreadcrumbItem } from "@/app/components/Breadcrumbs/BreadcrumbItem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { TreeNode } from "@/app/tree/nodes";
import { Ancestor, getAncestorsAsArray, useSetRoot } from "@/app/tree/utils";
import { truncateText, useIsMobile } from "@/app/util";
import { cn } from "@/lib/utils";

import styles, { default as s } from "./Breadcrumbs.module.css";

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

  const renderMenuItemContent = (text: string) => (
    <span className={cn({ [s.BlankContent]: !text })}>{truncateText(text || "(blank)", 32)}</span>
  );

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
  const setRoot = useSetRoot();

  // Only update when the node really changes (i.e. it has a different ID)
  const ancestors = useMemo(() => (treeNode.id ? getAncestorsAsArray(treeNode) : []), [treeNode.id]);

  const handleNavigation = useCallback(
    (index: number) => {
      if (index > ancestors.length) return;
      setRoot({
        relations: ancestors.slice(0, index).map((ancestor) => ancestor.relationToChild),
        object: index === ancestors.length ? treeNode.object : ancestors[index].object,
      });
    },
    [treeNode, ancestors, setRoot],
  );

  return (
    <nav className={s.BreadcrumbContainer} aria-label="breadcrumb">
      <div className={s.BreadcrumbWrapper}>
        <RenderBreadcrumbs treeNode={treeNode} ancestors={ancestors} handleNavigation={handleNavigation} />
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(s.PublicModeToggle, {
                [styles.IconPublicMode]: settingsStore.publicMode,
                [styles.IconPrivateMode]: !settingsStore.publicMode,
              })}
              onClick={() => settingsStore.setPublicMode(!settingsStore.publicMode)}
            >
              {settingsStore.publicMode ? <Unlock size={14} strokeWidth={1.5} /> : <Lock size={14} strokeWidth={1.5} />}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" align="center" sideOffset={5}>
            <div>{settingsStore.publicMode ? "Public mode" : "Private mode"}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </nav>
  );
});
