"use client";
import { HomeIcon, Plus } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useRef } from "react";
import { Options, useHotkeys } from "react-hotkeys-hook";

import { Breadcrumbs } from "@/app/components/Breadcrumbs/Breadcrumbs";
import { ControlsBar } from "@/app/components/ControlsBar/ControlsBar";
import { Button } from "@/app/components/UIPrimitives/Button";
import { NodeHeaderEditor } from "@/app/editor/NodeHeaderEditor";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { EditorSelectionAction } from '@/app/tree/selection';
import { Tree } from "@/app/tree/Tree";
import { TreeContext } from "@/app/tree/TreeContext";
import { useSetCurrentNodeAsRoot } from "@/app/tree/utils";
import { cn } from "@/lib/utils";

import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

import s from "./OutlineView.module.css";

export const OutlineView = observer(({ tree }: { tree: Tree }) => {
  const graphStore = useGraphStore();
  const treeRef = useRef<HTMLDivElement>(null);
  const hasFocus = useCallback(() => !!treeRef.current?.contains(document.activeElement), [treeRef]);
  useOutlineHotkeys({ tree, hasFocus });
  const treeNode = tree.state.root;
  const renderController = useRenderController();

  const handleShiftClickToSelectMultipleNodes = useCallback(
    (e: React.MouseEvent) => {
      const nodeElement = (e.target as HTMLElement).closest("[data-nodeid]");
      if (!nodeElement) return;

      const pathToClickedNode = nodeElement.getAttribute("data-editor-path");
      if (!pathToClickedNode) return;

      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        tree.selectBetweenShiftClick(pathToClickedNode, EditorSelectionAction.ClickedOnTextEditor);
      } else {
        tree.setFocusedNode(pathToClickedNode, undefined, EditorSelectionAction.ClickedOnTextEditor);
      }
    }, [tree]);

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
              {treeNode.object.id === graphStore.userRoot.id && <HomeIcon size={20} />}
              <h1 className={s.TitleText}>
                <NodeHeaderEditor treeNode={treeNode} />
              </h1>
            </div>

            <CreateNewButton tree={tree} />
          </div>
          <div className={s.Nodes} onClick={handleShiftClickToSelectMultipleNodes}>
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
