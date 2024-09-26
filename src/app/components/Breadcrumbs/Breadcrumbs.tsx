"use client";
import { ChevronRight, Ellipsis, Globe, Home, Lock, Unlock } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { GraphObject } from "@/app/graph/GraphObject";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { TreeNode } from "@/app/tree/nodes";
import { getAncestorsAsArray } from "@/app/tree/utils";
import { createRouteUrl, truncateText, useIsMobile } from "@/app/util";
import { cn } from "@/lib/utils";

import styles, { default as s } from "./Breadcrumbs.module.css";

const MAX_VISIBLE_ITEMS = 4; // For desktop view

export const Breadcrumbs = observer(({ treeNode }: { treeNode: TreeNode }) => {
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const router = useRouter();
  const isMobile = useIsMobile();
  const ancestors = getAncestorsAsArray(treeNode);

  const handleNavigation = (index: number) => {
    if (index > ancestors.length) return;
    router.push(
      createRouteUrl({
        relations: ancestors.slice(0, index).map((ancestor) => ancestor.relationToChild),
        object: index === ancestors.length ? treeNode.object : ancestors[index].object,
      }),
    );
  };

  const BreadcrumbItem = observer(
    ({
      object,
      path,
      index,
      isRoot = false,
    }: {
      object: GraphObject;
      path: string;
      index: number;
      isRoot?: boolean;
    }) => (
      <React.Fragment key={`${path}-${object.text}`}>
        {index > 0 && <ChevronRight size={12} strokeWidth={2} className={s.Separator} />}

        <span className={s.Breadcrumb} onClick={() => handleNavigation(index)}>
          {object.id === graphStore.globalRoot.id ? (
            <span className={s.Icon}>
              <Globe size={14} strokeWidth={1.5} />
            </span>
          ) : object.id === graphStore.userRoot.id ? (
            <span className={s.Icon}>
              <Home size={14} strokeWidth={1.5} />
            </span>
          ) : null}
          <span>{truncateText(isRoot ? object.text : object.text, isMobile ? 15 : 32)}</span>
          {isRoot && object.id !== graphStore.globalRoot.id && object.id !== graphStore.userRoot.id && (
            <span className={s.PublicStatus}>{object.isPublic && <Globe size={14} strokeWidth={1.5} />}</span>
          )}
        </span>
      </React.Fragment>
    ),
  );

  const RenderBreadcrumbs = () => {
    const totalItems = ancestors.length;

    if (isMobile) {
      // Mobile view (unchanged)
      const firstItem = ancestors[0];
      const middleItems = ancestors.slice(1);

      return (
        <>
          {ancestors.length > 0 && (
            <>
              <BreadcrumbItem object={firstItem.object} path={firstItem.path} index={0} />
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
                          {truncateText(ancestor.object.text, 32)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </>
          )}
          <BreadcrumbItem object={treeNode.object} path={treeNode.path} index={totalItems} isRoot={true} />
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
              />
            ))}
            <BreadcrumbItem
              key={`root-${treeNode.object.text}`}
              object={treeNode.object}
              path={treeNode.path}
              index={totalItems}
              isRoot={true}
            />
          </>
        );
      }

      return (
        <>
          {ancestors.length > 0 && (
            <>
              <BreadcrumbItem object={ancestors[0].object} path={ancestors[0].path} index={0} />
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
                      {truncateText(ancestor.object.text, 32)}
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
          />
        </>
      );
    }
  };

  return (
    <nav className={s.BreadcrumbContainer} aria-label="breadcrumb">
      <div className={s.BreadcrumbWrapper}>
        <RenderBreadcrumbs />
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
              style={{ cursor: "pointer" }}
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
