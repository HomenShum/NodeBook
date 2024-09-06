"use client";
import { ChevronRight, Ellipsis, Globe, Home, Lock } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { TreeNode } from "@/app/tree/nodes";
import { getAncestorsAsArray } from "@/app/tree/utils";
import { createRouteUrl, truncateText, useIsMobile } from "@/app/util";

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
    ({ ancestor, index, isRoot = false }: { ancestor: any; index: number; isRoot?: boolean }) => (
      <React.Fragment key={`${ancestor?.path}-${ancestor?.object?.text}`}>
        {index > 0 && <ChevronRight size={14} strokeWidth={2} className={s.Separator} />}

        <span className={s.Breadcrumb} onClick={() => handleNavigation(index)}>
          {ancestor.object.id === graphStore.globalRoot.id ? (
            <span className={s.Home}>
              <Globe size={14} />
            </span>
          ) : ancestor.object.id === graphStore.userRoot.id ? (
            <span className={s.Home}>
              <Home size={14} />
            </span>
          ) : null}
          <span>{truncateText(isRoot ? treeNode.object.text : ancestor?.object?.text || "", isMobile ? 15 : 32)}</span>
        </span>
      </React.Fragment>
    ),
  );

  const renderBreadcrumbs = () => {
    const totalItems = ancestors.length;

    if (isMobile) {
      // Mobile view (unchanged)
      const firstItem = ancestors[0];
      const middleItems = ancestors.slice(1);

      return (
        <>
          <BreadcrumbItem ancestor={firstItem} index={0} />
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
          <BreadcrumbItem ancestor={treeNode} index={totalItems} isRoot={true} />
        </>
      );
    } else {
      // Desktop view
      if (totalItems <= MAX_VISIBLE_ITEMS) {
        return (
          <>
            {ancestors.map((ancestor, index) => (
              <BreadcrumbItem key={`${ancestor.path}-${ancestor.object.text}`} ancestor={ancestor} index={index} />
            ))}
            <BreadcrumbItem key={`root-${treeNode.object.text}`} ancestor={treeNode} index={totalItems} isRoot={true} />
          </>
        );
      }

      return (
        <>
          <BreadcrumbItem ancestor={ancestors[0]} index={0} />
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
              ancestor={ancestor}
              index={totalItems - MAX_VISIBLE_ITEMS + 2 + index}
            />
          ))}
          <BreadcrumbItem key={`root-${treeNode.object.text}`} ancestor={treeNode} index={totalItems} isRoot={true} />
        </>
      );
    }
  };

  return (
    <nav className={s.BreadcrumbContainer} aria-label="breadcrumb">
      <div className={s.BreadcrumbWrapper}>{renderBreadcrumbs()}</div>
      <span className={s.PublicModeToggle} onClick={() => settingsStore.setPublicMode(!settingsStore.publicMode)}>
        {settingsStore.publicMode ? (
          <span className={styles.Icon}>
            <Globe size={14} strokeWidth={1.5} />
          </span>
        ) : (
          <span className={styles.Icon}>
            <Lock size={14} strokeWidth={1.5} />
          </span>
        )}
      </span>
    </nav>
  );
});
