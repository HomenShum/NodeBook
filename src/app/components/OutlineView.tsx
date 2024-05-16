"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { ChevronRight, Ellipsis, HomeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback } from "react";
import { ViewType } from "../controller/ViewController";
import { useViewController } from "../controller/useViewController";
import { searchGraph } from "../store/search";
import { useGraphStore } from "../store/useGraphStore";
import { relationsPathToParentChild } from "../util";
import s from "./OutlineView.module.css";
import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

// Function to truncate text if it's too long
const truncateText = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
};

export const OutlineView = observer(() => {
  const viewController = useViewController();
  const graphStore = useGraphStore();

  const relations = viewController.currentOutlineViewRoot;
  if (relations === null) {
    return <div>Root path is null</div>;
  }

  const path = relationsPathToParentChild(relations);
  const nodeAtPathEnd = path[path.length - 1].child;
  const searchResult = viewController.searchQuery ? searchGraph(nodeAtPathEnd, viewController.searchQuery) : undefined;

  if (!nodeAtPathEnd) {
    return <div>Missing root node</div>;
  }

  const createChild = useCallback(() => {
    viewController.createChildNode({ focusAfterCreate: true, targetView: ViewType.OUTLINE });
  }, [viewController]);

  const isLong = path.length > 5 || path.reduce((total, { child }) => total + child.text.length, 0) > 50;

  return (
    <div className={s.OutlineView}>
      <div className={s.OutlineContainer}>
        {path.length > 1 && (
          <div className={s.BreadcrumbContainer}>
            {path.map(({ relation, child }, i) => {
              const isFirst = i === 0;
              const isLast = i === path.length - 1;

              if (isFirst || isLast) {
                return (
                  <span
                    className={s.Breadcrumb}
                    key={relation.id}
                    onClick={() => viewController.setCurrentOutlineViewRoot(relations.slice(0, i + 1))}
                  >
                    {isFirst && <HomeIcon size={14} />}
                    {!isFirst && <ChevronRight size={14} strokeWidth={2} />}
                    <span>{truncateText(child.text, 20)}</span>
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
                      {path.slice(1, -1).map(({ relation, child }, index) => (
                        <DropdownMenuItem
                          key={relation.id}
                          className={s.BreadcrumbMenuItem}
                          onSelect={() => {
                            viewController.setCurrentOutlineViewRoot(relations.slice(0, index + 2));
                          }}
                        >
                          {truncateText(child.text, 20)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              return !isLong ? (
                <span
                  className={s.Breadcrumb}
                  key={relation.id}
                  onClick={() => viewController.setCurrentOutlineViewRoot(relations.slice(0, i + 1))}
                >
                  <ChevronRight size={14} strokeWidth={2} />
                  <span>{truncateText(child.text, 20)}</span>
                </span>
              ) : null;
            })}
          </div>
        )}

        <div className={s.TitleContainer}>
          {nodeAtPathEnd.id === graphStore.outlineRoot.id && <HomeIcon className={s.HomeIcon} size={20} />}
          <h1 className={s.TitleText}>{truncateText(nodeAtPathEnd.text, 58)}</h1>

          <button className={s.AddButton} onClick={createChild}>
            <span className={s.AddButtonIcon}>+</span>
          </button>
        </div>
        <RelatedObjectChildren pathToParentRelations={relations} searchResult={searchResult} />
      </div>
    </div>
  );
});
