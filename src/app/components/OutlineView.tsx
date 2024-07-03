"use client";
import { ChevronRight, Ellipsis, HomeIcon } from "lucide-react";
import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Options, useHotkeys } from "react-hotkeys-hook";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
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
  useOutlineHotkeys({ tree });
  useBindEditorFocusToTree({ tree });
  const treeNode = tree.state.root;
  const ancestors = getAncestorsAsArray(treeNode);
  return (
    <TreeContext.Provider value={tree}>
      <div className={s.OutlineView}>
        {ancestors.length > 1 && <Breadcrumbs treeNode={treeNode} />}
        <div className={s.TitleContainer}>
          {treeNode.object.id === graphStore.outlineRoot.id && <HomeIcon size={20} />}
          <h1 className={s.TitleText}>{truncate(treeNode.object.text, 40)}</h1>
          <CreateNewButton tree={tree} />
        </div>
        <RelatedObjectChildren treeNode={treeNode} />
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

const Breadcrumbs = observer(({ treeNode }: { treeNode: TreeNode }) => {
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
              <DropdownMenuContent sideOffset={4}>
                {ancestors.slice(1, -1).map(({ object, relationToChild, path }, index) => (
                  <DropdownMenuItem
                    key={path}
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
});

const truncate = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
};

const useBindEditorFocusToTree = ({ tree }: { tree: Tree }) => {
  const renderController = useRenderController();
  useEffect(() => {
    const disposer = autorun(() => {
      if (tree.selection?.type === "editor") {
        const editor = renderController.editorsByPath.get(tree.selection.treeNodeId);
        if (!editor) return;
        const hasFocus = editor.getRootElement()?.contains(document.activeElement);
        if (!hasFocus) {
          logger.debug("Focusing editor to match selection", { treeNodeId: tree.selection.treeNodeId });
          editor.focus();
        }
      } else {
        if (document.activeElement instanceof HTMLElement && document.activeElement?.dataset.lexicalEditor === "true") {
          logger.debug("Blurring editor to match selection", { type: tree.selection?.type });
          document.activeElement.blur();
        }
      }
    });
    return disposer;
  }, [tree, renderController]);
};

function useOutlineHotkeys({ tree }: { tree: Tree }) {
  const defaults: Options = { enableOnContentEditable: true, preventDefault: true };
  useHotkeys("mod+shift+ArrowUp", () => tree.moveSelectedNodesUp(), defaults, [tree]);
  useHotkeys("mod+shift+ArrowDown", () => tree.moveSelectedNodesDown(), defaults, [tree]);
  useHotkeys("ArrowUp", () => tree.moveEditorSelectionUp(), defaults, [tree]);
  useHotkeys("ArrowDown", () => tree.moveEditorSelectionDown(), defaults, [tree]);
  useHotkeys("shift+ArrowUp", () => tree.moveNodeSelectionHeadUp(), defaults, [tree]);
  useHotkeys("shift+ArrowDown", () => tree.moveNodeSelectionHeadDown(), defaults, [tree]);
  useHotkeys("delete", () => tree.deleteSelection(), [tree]);
  useHotkeys("backspace", () => tree.deleteSelection(), [tree]);
  useHotkeys("tab", () => tree.indentSelection(), defaults, [tree]);
  useHotkeys("shift+tab", () => tree.dedentSelection(), defaults, [tree]);
  useHotkeys("esc", () => tree.escapeSelection(), defaults, [tree]);
}
