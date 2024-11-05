"use client";
import { Globe, HomeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo } from "react";
import { Options, useHotkeys } from "react-hotkeys-hook";

import { Breadcrumbs } from "@/app/components/Breadcrumbs/Breadcrumbs";
import { ClickToCreateNodeButton } from "@/app/components/Buttons/ClickToCreateNodeButton";
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

import { ChildGroups, NoteContentSection } from "./RelatedObject/ChildGroups";

import s from "./OutlineView.module.css";

interface Props {
  tree: Tree;
}

export const OutlineView = observer(function OutlineView({ tree }: Props) {
  const user = useUser();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  useOutlineHotkeys({ tree });

  const treeRoot = tree.state.root;
  const userId = graphStore.user?.id;
  const isGlobalRoot = treeRoot.object.id === graphStore.globalRoot.id;

  const tooltipContent = useMemo(() => {
    const authorId = treeRoot.object.authorId;
    const authorName = authorId === userId ? "You" : graphStore.usersById.get(authorId)?.username || authorId;
    return isGlobalRoot ? null : (
      <>
        <div className={s.TooltipContent}>Node&apos;s author: {authorName}</div>
        <div className={s.TooltipContent}>Created: {new Date(treeRoot.object.createdAt).toLocaleDateString()}</div>
      </>
    );
  }, [isGlobalRoot, treeRoot.object.authorId, treeRoot.object.createdAt, userId, graphStore]);

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
          <Breadcrumbs treeNode={treeRoot} />
          <ControlsBar tree={tree} />
        </div>
        <div className={s.OutlineContent}>
          <div className={s.HeadingContainer}>
            <div className={s.TitleContainer}>
              <NodeHeaderSettingsMenu treeNode={treeRoot} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={s.IconAndTitle}>
                      {treeRoot.object.id === graphStore.homeRoot.id ? (
                        <HomeIcon size={20} />
                      ) : isGlobalRoot ? (
                        <Globe size={20} strokeWidth={1.8} />
                      ) : null}
                      <h1 className={s.TitleText}>
                        <NodeHeaderEditor key={treeRoot.object.id} treeNode={treeRoot} />
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
            {treeRoot.object.noteContentRelationsList.size > 0 && (
              <div className={s.NoteContentSection}>
                <NoteContentSection parentNode={treeRoot} group={treeRoot.childrenGroupsById.noteContent} />
              </div>
            )}
          </div>
          <div className={s.Nodes}>
            <ChildGroups treeNode={treeRoot} />
            {!user.isAnonymous && treeRoot.childCount === 0 && (
              <ClickToCreateNodeButton
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  tree.createChildOfRootAndFocus();
                }}
              />
            )}
          </div>
        </div>
      </div>
    </TreeContext.Provider>
  );
});

const useOutlineHotkeys = function useOutlineHotkeys({ tree }: { tree: Tree }) {
  const setRoot = useSetRoot();
  const defaults: Options = { enableOnContentEditable: true, preventDefault: true, enableOnFormTags: ["INPUT"] };

  useHotkeys("mod+shift+ArrowUp", () => tree.moveSelectedNodesUp(), defaults, [tree]);
  useHotkeys("mod+shift+ArrowDown", () => tree.moveSelectedNodesDown(), defaults, [tree]);
  useHotkeys("mod+ArrowUp", () => tree.collapseAtSelection(), defaults, [tree]);
  useHotkeys("mod+ArrowDown", () => tree.expandAtSelection(), defaults, [tree]);
  useHotkeys("shift+ArrowUp", () => tree.moveNodeSelectionHeadUp(), defaults, [tree]);
  useHotkeys("shift+ArrowDown", () => tree.moveNodeSelectionHeadDown(), defaults, [tree]);
  useHotkeys("delete", () => tree.deleteSelection(), { preventDefault: true }, [tree]);
  useHotkeys("backspace", () => tree.deleteSelection(), { preventDefault: true }, [tree]);
  useHotkeys("tab", () => tree.indentSelection(), defaults, [tree]);
  useHotkeys("shift+tab", () => tree.dedentSelection(), defaults, [tree]);
  useHotkeys("esc", () => tree.escapeSelection(), defaults, [tree]);

  // Zoom in on cmd+.
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

  // Zoom out on `mod+,`. For some reason this wasn't working with useHotkeys, so we're using a useEffect.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "," && tree.root.parent) {
        setRoot({
          object: tree.root.parent.object,
          relations: getAncestorsAsArray(tree.root)
            .slice(0, -1)
            .map((node) => node.relationToChild),
        });
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tree, setRoot]);

  useEffect(() => {
    const handleClipboardEvent = (e: ClipboardEvent) => {
      if (e.type === "copy") {
        const hasCopied = tree.copySelectedNodes(e);
        if (hasCopied) e.preventDefault();
      }
    };
    document.addEventListener("copy", handleClipboardEvent);
    return () => {
      document.removeEventListener("copy", handleClipboardEvent);
    };
  });
};
