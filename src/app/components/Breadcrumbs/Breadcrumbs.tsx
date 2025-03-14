"use client";
import { ArrowLeft, ChevronRight, Ellipsis, Home } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
import { TreeNode } from "@/app/tree/nodes";
import { BreadcrumbAncestors, getAncestorsAsArray, useSetMainRoot } from "@/app/tree/utils";
import { truncateText, useIsMobile } from "@/app/util";
import { GLOBAL_ROOT_ID, USER_ROOT_ID_PREFIX } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { default as s } from "./Breadcrumbs.module.css";

const MAX_VISIBLE_ITEMS = 4; // For desktop view

type RenderBreadcrumbsProps = {
  treeNode: TreeNode;
  ancestors: BreadcrumbAncestors[];
  handleNavigation: (index: number) => void;
};

const RenderMenuItemContent = (text: string) => (
  <span className={cn({ [s.BlankContent]: !text })}>{truncateText(text || "(blank)", 32)}</span>
);

const RenderBreadcrumbs = observer(({ treeNode, ancestors, handleNavigation }: RenderBreadcrumbsProps) => {
  const isMobile = useIsMobile();
  const graphStore = useGraphStore();
  const totalItems = ancestors.length;

  const layerObjectIds = ancestors.map((a) => a.object.id);
  graphStore.layerManager.loadWithIds(layerObjectIds);

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
  const setRoot = useSetMainRoot();
  const graphStore = useGraphStore();
  const [ancestors, setAncestors] = useState<BreadcrumbAncestors[]>(getAncestorsAsArray(treeNode));
  const router = useRouter();

  useEffect(() => {
    const hasUser =
      ancestors.some((elem) => elem.object.id.startsWith(USER_ROOT_ID_PREFIX)) ||
      treeNode.object.id.startsWith(USER_ROOT_ID_PREFIX);
    const hasGlobalRoot =
      ancestors.some((elem) => elem.object.id === GLOBAL_ROOT_ID) || treeNode.object.id === GLOBAL_ROOT_ID;

    if (!hasUser && !hasGlobalRoot) {
      const authorId = treeNode.object.authorId;
      const userNode = graphStore.getNode(USER_ROOT_ID_PREFIX + authorId);
      if (userNode) {
        const newAncestors = ancestors;
        newAncestors.unshift({
          object: userNode,
          relationToChild: null,
          childGroupId: null,
          path: "null",
        });
        const usersNode = graphStore.usersNode;
        const usersToUserRel = graphStore.usersToUserRelation;
        if (usersNode && usersToUserRel) {
          newAncestors.unshift({
            object: usersNode,
            relationToChild: usersToUserRel,
            childGroupId: null,
            path: "null",
          });
        }
        const globalRootNode = graphStore.globalRoot;
        const globalRootToUsersRel = graphStore.globalToUsersRelation;
        if (globalRootNode && globalRootToUsersRel) {
          newAncestors.unshift({
            object: globalRootNode,
            relationToChild: globalRootToUsersRel,
            childGroupId: null,
            path: "null",
          });
        }
        setAncestors(newAncestors);
      }
    }
  }, [ancestors, setAncestors, treeNode.object.authorId, graphStore, treeNode.object.id]);

  const handleNavigation = useCallback(
    (index: number) => {
      if (index > ancestors.length) return;
      const object = index === ancestors.length ? treeNode.object : ancestors[index].object;
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
          onClick={() => router.back()}
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
        </Button>
        <Button
          variant="default"
          size="icon"
          className={cn(s.ShowTooltip, s.BottomAlign)}
          data-tooltip="Your Root"
          onClick={() => setRoot(graphStore.getDefaultRootForUser())}
        >
          <Home size={14} strokeWidth={1.5} />
        </Button>
        <div className={s.BreadcrumbWrapper}>
          <RenderBreadcrumbs treeNode={treeNode} ancestors={ancestors} handleNavigation={handleNavigation} />
        </div>
        <BreadcrumbMenu />
      </nav>
    </>
  );
});
