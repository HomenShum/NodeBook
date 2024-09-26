"use client";
import { Globe, HomeIcon, Plus } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef } from "react";
import { Options, useHotkeys } from "react-hotkeys-hook";

import { Breadcrumbs } from "@/app/components/Breadcrumbs/Breadcrumbs";
import { ControlsBar } from "@/app/components/ControlsBar/ControlsBar";
import { NodeHeaderSettingsMenu } from "@/app/components/RelatedObject/NodeHeaderSettingsMenu";
import { ClickToCreateNode } from "@/app/components/RelatedObject/RelatedObjectView";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { NodeHeaderEditor } from "@/app/editor/NodeHeaderEditor";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { Tree } from "@/app/tree/Tree";
import { TreeContext } from "@/app/tree/TreeContext";
import { useSetCurrentNodeAsRoot } from "@/app/tree/utils";
import { cn } from "@/lib/utils";

import menuStyles from "./RelatedObject/NodeHeaderSettingsMenu.module.css";
import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

import s from "./OutlineView.module.css";

export const OutlineView = observer(({ tree }: { tree: Tree }) => {
  const graphStore = useGraphStore();
  const treeRef = useRef<HTMLDivElement>(null);
  const hasFocus = useCallback(() => !!treeRef.current?.contains(document.activeElement), [treeRef]);
  useOutlineHotkeys({ tree, hasFocus });
  const treeNode = tree.state.root;
  const renderController = useRenderController();

  const userId = graphStore.user?.id;
  const isGlobalRoot = treeNode.object.id === graphStore.globalRoot.id;

  const tooltipContent = !isGlobalRoot && (
    <>
      <div className={s.TooltipContent}>
        Object author: {treeNode.object.authorId === userId ? "You" : treeNode.object.authorId}
      </div>
      <div className={s.TooltipContent}>Created: {new Date(treeNode.object.createdAt).toLocaleDateString()}</div>
    </>
  );

  // Set the tree selection to null when the user clicks outside an editor
  useEffect(() => {
    function clearSelectionOnClickOutsideOutline(e: MouseEvent) {
      const isEditor =
        e.target instanceof HTMLElement &&
        e.target.closest('[data-lexical-editor="true"]') !== null &&
        (e.target.isContentEditable || e.target.tagName === "INPUT");
      if (!isEditor) {
        tree.setFocusedNode(null);
      }
    }
    window.addEventListener("click", clearSelectionOnClickOutsideOutline);
    return () => {
      window.removeEventListener("click", clearSelectionOnClickOutsideOutline);
    };
  }, [tree]);

  // const handleShiftClickToSelectMultipleNodes = useCallback(
  //   (e: React.MouseEvent) => {
  //     const nodeElement = (e.target as HTMLElement).closest("[data-nodeid]");
  //     if (!nodeElement) return;

  //     const pathToClickedNode = nodeElement.getAttribute("data-editor-path");
  //     if (!pathToClickedNode) return;

  //     e.preventDefault();
  //     e.stopPropagation();
  //     if (e.shiftKey) {
  //       tree.selectBetweenShiftClick(pathToClickedNode, EditorSelectionAction.ClickedOnTextEditor);
  //     } else {
  //       console.log("handleShiftClickToSelectMultipleNodes", pathToClickedNode);
  //       tree.setFocusedNode(pathToClickedNode, undefined, EditorSelectionAction.ClickedOnTextEditor);
  //     }
  //   },
  //   [tree],
  // );

  return (
    <TreeContext.Provider value={tree}>
      <div
        className={cn(s.OutlineView, {
          [s.OutlineViewFull]: !renderController.leftSidebarOpen,
        })}
      >
        <div className={s.WindowNav}>
          <Breadcrumbs treeNode={treeNode} />
          <ControlsBar tree={tree} />
        </div>
        <div className={s.OutlineContent}>
          <div className={s.HeadingContainer}>
            <div className={s.TitleContainer}>
              <div className={menuStyles.MenuTrigger}>
                <div className={menuStyles.MenuIcon}>
                  <NodeHeaderSettingsMenu treeNode={treeNode} />
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={s.IconAndTitle}>
                      {treeNode.object.id === graphStore.userRoot.id ? (
                        <HomeIcon size={20} />
                      ) : isGlobalRoot ? (
                        <Globe size={20} />
                      ) : null}
                      <h1 className={s.TitleText}>
                        <NodeHeaderEditor key={treeNode.object.id} treeNode={treeNode} />
                      </h1>
                    </div>
                  </TooltipTrigger>
                  {tooltipContent && (
                    <TooltipContent side="top" align="start" sideOffset={5}>
                      {tooltipContent}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>

            <CreateNewButton tree={tree} />
          </div>
          <div className={s.Nodes}>
            <ClickToCreateNode treeNode={treeNode} />
            <RelatedObjectChildren treeNode={treeNode} />
          </div>
        </div>
      </div>
    </TreeContext.Provider>
  );
});
function CreateNewButton({ tree }: { tree: Tree }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        await tree.createChildOfRootAndFocus();
      }}
    >
      <Plus size={16}></Plus>
    </Button>
  );
}

function useOutlineHotkeys({ tree, hasFocus }: { tree: Tree; hasFocus: () => boolean }) {
  const defaults: Options = { enableOnContentEditable: true, preventDefault: true, enableOnFormTags: ["INPUT"] };
  useHotkeys("mod+shift+ArrowUp", () => tree.moveSelectedNodesUp(), defaults, [tree]);
  useHotkeys("mod+shift+ArrowDown", () => tree.moveSelectedNodesDown(), defaults, [tree]);
  useHotkeys("mod+ArrowUp", () => tree.collapseAtSelection(), defaults, [tree]);
  useHotkeys("mod+ArrowDown", () => tree.expandAtSelection(), defaults, [tree]);
  useHotkeys("ArrowUp", () => tree.moveEditorSelectionUp(), defaults, [tree]);
  useHotkeys("ArrowDown", () => tree.moveEditorSelectionDown(), defaults, [tree]);
  useHotkeys("shift+ArrowUp", () => tree.moveNodeSelectionHeadUp(), defaults, [tree]);
  useHotkeys("shift+ArrowDown", () => tree.moveNodeSelectionHeadDown(), defaults, [tree]);
  useHotkeys("delete", () => tree.deleteSelection(), { preventDefault: true }, [tree]);
  useHotkeys("backspace", () => tree.deleteSelection(), { preventDefault: true }, [tree]);
  useHotkeys("tab", () => tree.indentSelection(), defaults, [tree]);
  useHotkeys("shift+tab", () => tree.dedentSelection(), defaults, [tree]);
  useHotkeys("esc", () => tree.escapeSelection(), defaults, [tree]);
  const setCurrentNodeAsRoot = useSetCurrentNodeAsRoot(tree);
  useHotkeys("mod+.", setCurrentNodeAsRoot, defaults, [tree]);
}
