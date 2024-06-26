import { ChevronRight, Ellipsis } from "lucide-react";
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
import { relationsToURLPath, useCurView } from "@/app/util";
import { Tree, getAncestorsAsArray } from "@/app/view/Tree";
import { TreeContext } from "@/app/view/TreeContext";
import { ViewType } from "@/app/view/ViewType";

import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

import stylesList from "./OutlineView.module.css";
import stylesStream from "./ThoughtstreamView.module.css";

const truncateText = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
};

export const ThoughtstreamView = observer(({ tree }: { tree: Tree }) => {
  const renderController = useRenderController();
  const graphStore = useGraphStore();
  const curView = useCurView();
  const router = useRouter();

  const { root: treeNode } = tree.state;
  const ancestors = getAncestorsAsArray(treeNode);
  const isLong = treeNode.depth > 5 || ancestors.reduce((total, { object }) => total + object.text.length, 0) > 50;
  const relations = ancestors.map((a) => a.relationToChild);

  return (
    <TreeContext.Provider value={tree}>
      <div tabIndex={0} className={stylesStream.StreamContainer}>
        <div>
          {ancestors.length > 1 && (
            <div className={stylesList.BreadcrumbContainer}>
              {ancestors.slice(0, -1).map(({ object, path }, i) => {
                const isFirst = i === 0;
                const isSecondLast = i === ancestors.length - 2;
                if (isFirst || isSecondLast) {
                  return (
                    <span
                      className={stylesList.Breadcrumb}
                      key={path}
                      onClick={() => {
                        if (curView !== ViewType.SPLIT) {
                          router.push(`/stream${relationsToURLPath(relations.slice(0, i + 1), graphStore)}`);
                        } else {
                          router.push(
                            `/split/outline${relationsToURLPath(
                              tree.pathToRoot,
                              graphStore,
                            )}/stream${relationsToURLPath(relations.slice(0, i + 1), graphStore)}`,
                          );
                        }
                      }}
                    >
                      {!isFirst && <ChevronRight size={14} strokeWidth={2} />}
                      <span>{truncateText(object.text, 20)}</span>
                    </span>
                  );
                }

                if (isLong && i === 1) {
                  return (
                    <DropdownMenu key="ellipsis">
                      <DropdownMenuTrigger asChild>
                        <span className={stylesList.Breadcrumb}>
                          <ChevronRight size={14} />
                          <Ellipsis size={14} />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className={stylesList.BreadcrumbDropdownMenu} align="start" sideOffset={5}>
                        {ancestors.slice(1, -1).map(({ object, relationToChild, path }, index) => (
                          <DropdownMenuItem
                            key={path}
                            className={stylesList.BreadcrumbMenuItem}
                            onSelect={() => {
                              if (curView !== ViewType.SPLIT) {
                                router.push(`/stream${relationsToURLPath(relations.slice(0, index + 2), graphStore)}`);
                              } else {
                                router.push(
                                  `/split/outline${relationsToURLPath(
                                    tree.pathToRoot,
                                    graphStore,
                                  )}/stream${relationsToURLPath(relations.slice(0, index + 2), graphStore)}`,
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
                    className={stylesList.Breadcrumb}
                    key={path}
                    onClick={() => {
                      if (curView !== ViewType.SPLIT) {
                        router.push(`/stream${relationsToURLPath(relations.slice(0, i + 1), graphStore)}`);
                      } else {
                        router.push(
                          `/split/outline${relationsToURLPath(tree.pathToRoot, graphStore)}/stream${relationsToURLPath(
                            relations.slice(0, i + 1),
                            graphStore,
                          )}`,
                        );
                      }
                    }}
                  >
                    <ChevronRight size={14} strokeWidth={2} />
                    <span>{truncateText(object.text, 20)}</span>
                  </span>
                ) : null;
              })}
              <span className={stylesList.Chevron}>
                <ChevronRight size={14} strokeWidth={2} />
              </span>
            </div>
          )}
          <div className={stylesList.TitleContainer}>
            {(curView === ViewType.SPLIT || ancestors.length > 1) && (
              <h1 className={stylesList.TitleText}>{truncateText(treeNode.object.text, 40)}</h1>
            )}
            <button
              className={stylesList.AddButton}
              onClick={async () => {
                await tree.createChildNodeAndFocus();
              }}
            >
              <span className={stylesList.AddButtonIcon}>+</span>
            </button>
          </div>
        </div>
        <div>
          <RelatedObjectChildren treeNode={treeNode} />
        </div>
      </div>
    </TreeContext.Provider>
  );
});
