"use client";
import { ChevronRight, Ellipsis, HomeIcon } from "lucide-react";
import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { KeyboardEventHandler, useCallback, useEffect } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/DropdownMenu";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { relationsToURLPath, useCurView } from "@/app/util";
import { Tree, TreeNode, getAncestorsAsArray } from "@/app/view/Tree";
import { TreeContext } from "@/app/view/TreeContext";
import { ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";

import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

import s from "./OutlineView.module.css";

export const OutlineView = observer(({ tree }: { tree: Tree }) => {
  const graphStore = useGraphStore();
  const { root: treeNode } = tree.state;
  const ancestors = getAncestorsAsArray(treeNode);
  const shortcutsHandler = useShortcutsHandler({ tree });
  const renderController = useRenderController();

  // Whenever the tree selection changes, focus the editor that corresponds to the selection
  useEffect(() => {
    const disposer = autorun(() => {
      if (tree.selection?.type !== "editor") return;
      const editor = renderController.editorsByPath.get(tree.selection.treeNodeId);
      if (!editor) return;
      const hasFocus = editor.getRootElement()?.contains(document.activeElement);
      if (!hasFocus) {
        logger.debug("Focusing editor to match selection", { treeNodeId: tree.selection.treeNodeId });
        editor.focus();
      }
    });
    return disposer;
  }, [tree, renderController]);

  return (
    <TreeContext.Provider value={tree}>
      <div className={s.OutlineView} onKeyDown={shortcutsHandler}>
        <div className={s.OutlineViewContainer}>
          {ancestors.length > 1 && <Breadcrumbs treeNode={treeNode} />}
          <div className={s.TitleContainer}>
            {treeNode.object.id === graphStore.outlineRoot.id && <HomeIcon className={s.HomeIcon} size={20} />}
            <h1 className={s.TitleText}>{truncate(treeNode.object.text, 40)}</h1>
            <CreateNewButton tree={tree} />
          </div>
          <RelatedObjectChildren treeNode={treeNode} />
        </div>
      </div>
    </TreeContext.Provider>
  );
});

function CreateNewButton({ tree }: { tree: Tree }) {
  return (
    <button
      className={s.AddButton}
      onClick={async () => {
        await tree.createChildNodeAndFocus();
      }}
    >
      <span className={s.AddButtonIcon}>+</span>
    </button>
  );
}

function Breadcrumbs({ treeNode }: { treeNode: TreeNode }) {
  const router = useRouter();
  const curView = useCurView();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const ancestors = getAncestorsAsArray(treeNode);
  const isLong = treeNode.depth > 5 || ancestors.reduce((total, { object }) => total + object.text.length, 0) > 50;
  const relations = ancestors.map((a) => a.relationToChild);
  return (
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
                    )}/stream${relationsToURLPath(viewStore.mainStreamView.pathToRoot, graphStore)}`,
                  );
                }
              }}
            >
              {isFirst && <HomeIcon size={14} />}
              {!isFirst && <ChevronRight size={14} strokeWidth={2} />}
              <span>{truncate(object.text, 20)}</span>
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
                          )}/stream${relationsToURLPath(viewStore.mainStreamView.pathToRoot, graphStore)}`,
                        );
                      }
                    }}
                  >
                    {truncate(object.text, 20)}
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
                  )}/stream${relationsToURLPath(viewStore.mainStreamView.pathToRoot, graphStore)}`,
                );
              }
            }}
          >
            <ChevronRight size={14} strokeWidth={2} />
            <span>{truncate(object.text, 20)}</span>
          </span>
        ) : null;
      })}
      <span className={s.Chevron}>
        <ChevronRight size={14} strokeWidth={2} />
      </span>
    </div>
  );
}

const truncate = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
};

function useShortcutsHandler({ tree }: { tree: Tree }): KeyboardEventHandler {
  const renderController = useRenderController();
  return useCallback(
    (e) => {
      const metaOrCtrl = e.metaKey || e.ctrlKey; // Command key on Mac, Ctrl key on Windows
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (metaOrCtrl && e.shiftKey) {
          const moved = e.key === "ArrowUp" ? tree.moveNodeWithSelectionDown() : tree.moveNodeWithSelectionDown();
          if (moved) e.preventDefault();
        }
      }
    },
    [tree, renderController],
  );
}
