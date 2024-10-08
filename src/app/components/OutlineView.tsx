"use client";
import { Globe, HomeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo } from "react";
import { Options, useHotkeys } from "react-hotkeys-hook";

import { Breadcrumbs } from "@/app/components/Breadcrumbs/Breadcrumbs";
import { ClickToCreateNodeButton } from "@/app/components/Buttons/ClickToCreateNodeButton";
import { CreateNewButton } from "@/app/components/Buttons/CreateNewButton";
import { ControlsBar } from "@/app/components/ControlsBar/ControlsBar";
import { NodeHeaderSettingsMenu } from "@/app/components/RelatedObject/NodeHeaderSettingsMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { NodeHeaderEditor } from "@/app/editor/NodeHeaderEditor";
import { Tree } from "@/app/tree/Tree";
import { TreeContext } from "@/app/tree/TreeContext";
import { getAncestorsAsArray, useSetRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { ChildGroups } from "./RelatedObject/ChildGroups";

import s from "./OutlineView.module.css";

interface Props {
  tree: Tree;
}

export const OutlineView = observer(function OutlineView({ tree }: Props) {
  const user = useUser();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  useOutlineHotkeys({ tree });

  const treeNode = tree.state.root;
  const userId = graphStore.user?.id;
  const isGlobalRoot = treeNode.object.id === graphStore.globalRoot.id;

  const tooltipContent = useMemo(
    () =>
      isGlobalRoot ? null : (
        <>
          <div className={s.TooltipContent}>
            Object author: {treeNode.object.authorId === userId ? "You" : treeNode.object.authorId}
          </div>
          <div className={s.TooltipContent}>Created: {new Date(treeNode.object.createdAt).toLocaleDateString()}</div>
        </>
      ),
    [isGlobalRoot, treeNode.object.authorId, treeNode.object.createdAt, userId],
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

  return (
    <TreeContext.Provider value={tree}>
      <div
        className={cn(s.OutlineView, {
          [s.OutlineViewFull]: !viewStore.leftSidebarOpen,
        })}
      >
        <div className={s.WindowNav}>
          <Breadcrumbs treeNode={treeNode} />
          <ControlsBar tree={tree} />
        </div>
        <div className={s.OutlineContent}>
          <div className={s.HeadingContainer}>
            <div className={s.TitleContainer}>
              <NodeHeaderSettingsMenu treeNode={treeNode} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={s.IconAndTitle}>
                      {treeNode.object.id === graphStore.homeRoot.id ? (
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

            {!user.isAnonymous && <CreateNewButton tree={tree} />}
          </div>
          <div className={s.Nodes}>
            {!user.isAnonymous && <ClickToCreateNodeButton treeNode={treeNode} />}
            <ChildGroups treeNode={treeNode} />
          </div>
        </div>
      </div>
    </TreeContext.Provider>
  );
});

function useOutlineHotkeys({ tree }: { tree: Tree }) {
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

  const setRoot = useSetRoot();
  const setCurrentNodeAsRoot = useCallback(() => {
    if (tree.selectionWithNodes?.type === "editor") {
      const node = tree.selectionWithNodes.treeNode;
      setRoot({
        object: node.object,
        relations: getAncestorsAsArray(node).map((node) => node.relationToChild),
      });
    }
  }, [tree, setRoot]);
  useHotkeys("mod+.", setCurrentNodeAsRoot, defaults, [tree]);
}
