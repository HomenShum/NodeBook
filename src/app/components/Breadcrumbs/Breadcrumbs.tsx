"use client";
import { ChevronRight, Ellipsis, Globe, Lock, User } from "lucide-react";
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
import { useGraphStore } from "@/app/graph/useGraphStore";
import { TreeNode } from "@/app/tree/nodes";
import { getAncestorsAsArray } from "@/app/tree/utils";
import { relationsToURLPath, useCurView } from "@/app/util";
import { ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";

import styles, { default as s } from "./Breadcrumbs.module.css";

const MAX_VISIBLE_ITEMS = 4;

export const Breadcrumbs = observer(({ treeNode }: { treeNode: TreeNode }) => {
  const router = useRouter();
  const curView = useCurView();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const ancestors = getAncestorsAsArray(treeNode);
  const relations = ancestors.map((a) => a.relationToChild);
  if (!(treeNode.object instanceof GraphNode)) return null;

  const handleNavigation = (index: number) => {
    const targetRelations = relations.slice(0, index);
    if (curView !== ViewType.SPLIT) {
      router.push(`/outline${relationsToURLPath(targetRelations, graphStore)}`);
    } else {
      router.push(
        `/split/outline${relationsToURLPath(targetRelations, graphStore)}/stream${relationsToURLPath(
          viewStore.mainStreamView.pathToRoot,
          graphStore,
        )}`,
      );
    }
  };

  const BreadcrumbItem = ({ ancestor, index }: { ancestor: any; index: number }) => (
    <React.Fragment key={ancestor.path}>
      {index > 0 && <ChevronRight size={14} strokeWidth={2} className={s.Separator} />}
      <span className={s.Breadcrumb} onClick={() => handleNavigation(index)}>
        {index === 0 ? <User size={14} /> : null}
        <span>{truncate(ancestor.object.text, 32)}</span>
      </span>
    </React.Fragment>
  );

  const BreadcrumbItemArray = () => {
    const totalItems = ancestors.length;

    if (totalItems <= MAX_VISIBLE_ITEMS) {
      return ancestors.map((ancestor, index) => (
        <BreadcrumbItem key={ancestor.path} ancestor={ancestor} index={index} />
      ));
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
                {truncate(ancestor.object.text, 32)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {ancestors.slice(-MAX_VISIBLE_ITEMS + 2).map((ancestor, index) => (
          <BreadcrumbItem key={ancestor.path} ancestor={ancestor} index={totalItems - MAX_VISIBLE_ITEMS + 2 + index} />
        ))}
      </>
    );
  };

  return (
    <nav className={s.BreadcrumbContainer} aria-label="breadcrumb">
      <div className={s.BreadcrumbWrapper}>
        <BreadcrumbItemArray />
        <ChevronRight size={14} strokeWidth={2} className={s.Chevron} />
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

const truncate = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
};
