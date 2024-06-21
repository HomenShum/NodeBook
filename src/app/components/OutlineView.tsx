"use client";
import { ChevronRight, Ellipsis, HomeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/DropdownMenu";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { relationsToPathStr, relationsToURLPath, useCurView } from "@/app/util";
import { Tree, TreeContext, getAncestorsAsArray } from "@/app/view/Tree";
import { ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";

import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

import s from "./OutlineView.module.css";

// Function to truncate text if it's too long
const truncateText = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
};

export const OutlineView = observer(({ outline }: { outline: Tree }) => {
  const renderController = useRenderController();
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const router = useRouter();
  const curView = useCurView();

  const treeNode = outline.rootTreeNode;
  if (treeNode === null) {
    return <div>Root path is empty</div>;
  }

  const ancestors = getAncestorsAsArray(treeNode);
  const isLong = treeNode.depth > 5 || ancestors.reduce((total, { object }) => total + object.text.length, 0) > 50;

  const relations = ancestors.map((a) => a.relationToChild);
  return (
    <TreeContext.Provider value={outline}>
      <div className={s.OutlineView}>
        <div className={s.OutlineViewContainer}>
          {ancestors.length > 1 && (
            <div className={s.BreadcrumbContainer}>
              {ancestors.slice(1).map(({ object, path }, i) => {
                const isFirst = i === 0;
                const isSecondLast = i === path.length - 2;

                if (isFirst || isSecondLast) {
                  return (
                    <span
                      className={s.Breadcrumb}
                      key={path}
                      onClick={() => {
                        if (curView !== ViewType.SPLIT) {
                          router.push(`/outline${relationsToURLPath(relations.slice(0, i + 1), graphStore)}`);
                        } else {
                          router.push(
                            `/split/outline${relationsToURLPath(
                              relations.slice(0, i + 1),
                              graphStore,
                            )}/stream${relationsToURLPath(viewStore.mainStreamView.root, graphStore)}`,
                          );
                        }
                      }}
                    >
                      {isFirst && <HomeIcon size={14} />}
                      {!isFirst && <ChevronRight size={14} strokeWidth={2} />}
                      <span>{truncateText(object.text, 20)}</span>
                    </span>
                  );
                }

                if (isLong && i === 1) {
                  return (
                    <DropdownMenu key="ellipsis">
                      <DropdownMenuTrigger asChild>
                        <span className={s.Breadcrumb}>
                          <ChevronRight size={14} />
                          <Ellipsis size={14} />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className={s.BreadcrumbDropdownMenu} align="start" sideOffset={5}>
                        {ancestors.slice(1, -1).map(({ object, relationToChild, path }, index) => (
                          <DropdownMenuItem
                            key={path}
                            className={s.BreadcrumbMenuItem}
                            onSelect={() => {
                              if (curView !== ViewType.SPLIT) {
                                router.push(`/outline${relationsToURLPath(relations.slice(0, index + 2), graphStore)}`);
                              } else {
                                router.push(
                                  `/split/outline${relationsToURLPath(
                                    relations.slice(0, index + 2),
                                    graphStore,
                                  )}/stream${relationsToURLPath(viewStore.mainStreamView.root, graphStore)}`,
                                );
                              }
                            }}
                          >
                            {truncateText(object.text, 20)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }

                return !isLong ? (
                  <span
                    className={s.Breadcrumb}
                    key={path}
                    onClick={() => {
                      if (curView !== ViewType.SPLIT) {
                        router.push(`/outline${relationsToURLPath(relations.slice(0, i + 1), graphStore)}`);
                      } else {
                        router.push(
                          `/split/outline${relationsToURLPath(
                            relations.slice(0, i + 1),
                            graphStore,
                          )}/stream${relationsToURLPath(viewStore.mainStreamView.root, graphStore)}`,
                        );
                      }
                    }}
                  >
                    <ChevronRight size={14} strokeWidth={2} />
                    <span>{truncateText(object.text, 20)}</span>
                  </span>
                ) : null;
              })}
              <span className={s.Chevron}>
                <ChevronRight size={14} strokeWidth={2} />
              </span>
            </div>
          )}

          <div className={s.TitleContainer}>
            {treeNode.object.id === graphStore.outlineRoot.id && <HomeIcon className={s.HomeIcon} size={20} />}
            <h1 className={s.TitleText}>{truncateText(treeNode.object.text, 40)}</h1>

            <button
              className={s.AddButton}
              onClick={async () => {
                const { path } = await outline.createChildNode();
                renderController.setFocusedNode(relationsToPathStr(path));
              }}
            >
              <span className={s.AddButtonIcon}>+</span>
            </button>
          </div>
          <RelatedObjectChildren
            treeNode={treeNode}
            // searchResult={searchResult}
            // searchResultDate={searchResultDate}
          />
        </div>
      </div>
    </TreeContext.Provider>
  );
});
