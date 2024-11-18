import React, { useEffect, useMemo, useRef } from "react";
import { Globe, HomeIcon, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import isHotkey from "is-hotkey";

import { Tree } from "@/app/tree/Tree";
import s from "@/app/components/OutlineView.module.css";
import s1 from "@/app/components/RightSidebar.module.css";
import { NodeHeaderSettingsMenu } from "@/app/components/RelatedObject/NodeHeaderSettingsMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { NodeHeaderEditor } from "@/app/editor/NodeHeaderEditor";
import { ChildGroups, NoteContentSection } from "@/app/components/RelatedObject/ChildGroups";
import { ClickToCreateNodeButton } from "@/app/components/Buttons/ClickToCreateNodeButton";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { useViewStore } from "@/app/view/useViewStore";
import {
  handleTreeHotkeys,
  isEscapeSelectionHotkey,
  isMoveUpHotKey,
  isZoomInHotkey,
  isZoomOutHotkey,
} from "@/app/hotkeys";
import { createRouteUrl } from "@/app/util";
import logger from "@/lib/logger";
import { getAncestorsAsArray, useSetRoot } from "@/app/tree/utils";

interface Props {
  tree: Tree;
}

function OutlineContent({ tree }: Props) {
  const treeRoot = tree.state.root;
  const graphStore = useGraphStore();
  const user = useUser();
  const viewStore = useViewStore();
  const setRoot = useSetRoot();
  const elementRef = useRef<HTMLDivElement>(null);

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

  const setCurrentNodeAsRoot = () => {
    if (tree.selectionWithNodes?.type !== "editor") return;
    const node = tree.selectionWithNodes.treeNode;
    if (tree.isMainTree) {
      setRoot({
        object: node.object,
        relations: getAncestorsAsArray(node).map((node) => node.relationToChild),
      });
    } else {
      tree.setRoot(node, node.path);
    }
  };

  const setParentOfRootAsRoot = () => {
    if (!tree.root.parent) return;
    if (tree.isMainTree) {
      setRoot({
        object: tree.root.parent.object,
        relations: getAncestorsAsArray(tree.root)
          .slice(0, -1)
          .map((node) => node.relationToChild),
      });
    } else {
      tree.setRoot(tree.root.parent, tree.root.parent.path);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      let wasEventHandled = false;
      if (tree.id === viewStore.quickCaptureTree?.id && isEscapeSelectionHotkey(event)) {
        wasEventHandled = true;
        viewStore.toggleQuickCapture();
      }
      if (!wasEventHandled) {
        wasEventHandled = handleTreeHotkeys(event, tree);
      }
      if (isZoomInHotkey(event)) {
        wasEventHandled = true;
        setCurrentNodeAsRoot();
      }
      if (isZoomOutHotkey(event)) {
        wasEventHandled = true;
        setParentOfRootAsRoot();
      }
      if (wasEventHandled) {
        logger.debug(`KeyboardEvent was handled by OutlineContent for treeId:`, tree.id);
      }
      viewStore.setActiveTree(tree);
    };
    const handleFocus = () => {
      viewStore.setActiveTree(tree);
    };
    const element = elementRef.current;
    element && element.addEventListener("keydown", handleKeyDown);
    element && element.addEventListener("focusin", handleFocus);
    return () => {
      element && element.removeEventListener("keydown", handleKeyDown);
      element && element.removeEventListener("focusin", handleFocus);
    };
  });

  return (
    <div id={tree.id} tabIndex={-1} className={s.OutlineContent} ref={elementRef}>
      <span className={s1.CloseTreeButton} onClick={() => viewStore.deleteSidebarTree(tree.id)}>
        <X />
      </span>
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
  );
}

export default observer(OutlineContent);
