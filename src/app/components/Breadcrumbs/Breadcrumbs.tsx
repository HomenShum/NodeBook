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
import { GraphNode } from "@/app/graph/GraphNode";
import { TreeNode } from "@/app/tree/nodes";
import { getAncestorsAsArray } from "@/app/tree/utils";
import { createRouteUrl, truncateText } from "@/app/util";
import { ViewType } from "@/app/view/ViewType";

import styles, { default as s } from "./Breadcrumbs.module.css";

const MAX_VISIBLE_ITEMS = 4;

export const Breadcrumbs = observer(({ treeNode }: { treeNode: TreeNode }) => {
  const router = useRouter();
  const ancestors = getAncestorsAsArray(treeNode);
  if (!(treeNode.object instanceof GraphNode)) return null;

  const handleNavigation = (index: number) => {
    router.push(
      createRouteUrl(ViewType.GRAPH, {
        relations: ancestors.slice(0, index).map((ancestor) => ancestor.relationToChild),
        object: ancestors[index].object,
      }),
    );
  };

  const BreadcrumbItem = observer(({ ancestor, index }: { ancestor: any; index: number }) => (
    <React.Fragment key={ancestor.path}>
      {index > 0 && <ChevronRight size={14} strokeWidth={2} className={s.Separator} />}
      <span className={s.Breadcrumb} onClick={() => handleNavigation(index)}>
        <span>{truncateText(ancestor.object.text, 32)}</span>
      </span>
    </React.Fragment>
  ));

  const BreadcrumbItemArray = () => {
    const totalItems = ancestors.length;

    if (totalItems <= MAX_VISIBLE_ITEMS) {
      return (
        <>
          {ancestors.map((ancestor, index) => (
            <BreadcrumbItem key={ancestor.path} ancestor={ancestor} index={index} />
          ))}
          <BreadcrumbItem key="root" ancestor={treeNode} index={totalItems} />
        </>
      );
    }

    return (
      <>
        <BreadcrumbItem key={ancestors[0].path} ancestor={ancestors[0]} index={0} />
        <ChevronRight key="chevron-1" size={14} strokeWidth={2} className={s.Separator} />
        <DropdownMenu key="dropdown">
          <DropdownMenuTrigger asChild>
            <span className={s.Breadcrumb}>
              <Ellipsis size={14} />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={4}>
            {ancestors.slice(1, -MAX_VISIBLE_ITEMS + 2).map((ancestor, index) => (
              <DropdownMenuItem key={ancestor.path} onSelect={() => handleNavigation(index + 1)}>
                {truncateText(ancestor.object.text, 32)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {ancestors.slice(-MAX_VISIBLE_ITEMS + 1).map((ancestor, index) => (
          <BreadcrumbItem key={ancestor.path} ancestor={ancestor} index={totalItems - MAX_VISIBLE_ITEMS + 1 + index} />
        ))}
        <BreadcrumbItem key="root" ancestor={treeNode} index={totalItems} />
      </>
    );
  };

  return (
    <nav className={s.BreadcrumbContainer} aria-label="breadcrumb">
      <button className={s.Home} onClick={() => router.push(createRouteUrl(ViewType.GRAPH, "home"))}>
        <Home size={14} />
      </button>
      <div className={s.BreadcrumbWrapper}>
        <BreadcrumbItemArray />
      </div>
      <span className={s.ActionButtons}>
        {!treeNode.object.isPrivate ? (
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
