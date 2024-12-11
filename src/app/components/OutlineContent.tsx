import { Globe, HomeIcon, Link, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useRef } from "react";

import { ClickToCreateNodeButton } from "@/app/components/Buttons/ClickToCreateNodeButton";
import s from "@/app/components/OutlineView.module.css";
import { ChildGroups, NoteContentSection } from "@/app/components/RelatedObject/ChildGroups";
import { NodeHeaderSettingsMenu } from "@/app/components/RelatedObject/NodeHeaderSettingsMenu";
import { RootObjectDetails } from "@/app/components/RelatedObject/RelatedObjectDetails";
import s1 from "@/app/components/RightSidebar.module.css";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { NodeHeaderEditor } from "@/app/editor/NodeHeaderEditor";
import { useToast } from "@/app/hooks/useToast";
import { handleTreeHotkeys, isEscapeSelectionHotkey, isZoomInHotkey, isZoomOutHotkey } from "@/app/hotkeys";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";
import { Tree } from "@/app/tree/Tree";
import { treeNodeToObjectPath, useSetRoot } from "@/app/tree/utils";
import { copyObjectUrlToClipboard } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import breadcrumbs from "./Breadcrumbs/Breadcrumbs.module.css";

interface Props {
  tree: Tree;
}

function OutlineContent({ tree }: Props) {
  const treeRoot = tree.state.root;
  const graphStore = useGraphStore();
  const user = useUser();
  const viewStore = useViewStore();
  const settingsStore = useSettingsStore();
  const { addToast } = useToast();
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

  const setCurrentNodeAsRoot = (forceUpdateMainTree: boolean = false) => {
    if (tree.selectionWithNodes?.type !== "editor") return;
    const node = tree.selectionWithNodes.treeNode;
    if (tree.isMainTree || forceUpdateMainTree) {
      setRoot(node.object);
    } else {
      tree.setRoot(node.object);
    }
  };

  const setParentOfRootAsRoot = () => {
    if (!tree.root.parent) return;
    if (tree.isMainTree) {
      setRoot(tree.root.parent.object);
    } else {
      tree.setRoot(tree.root.parent.object);
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
        setCurrentNodeAsRoot(tree instanceof QuickCaptureTree || tree instanceof QuickCaptureSearchTree);
      }
      if (isZoomOutHotkey(event)) {
        wasEventHandled = true;
        setParentOfRootAsRoot();
      }
      if (wasEventHandled) {
        if (!tree.selection || tree.selection.type === "node") {
          elementRef.current && elementRef.current.focus();
        }
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
              <div className={s.IconAndTitle}>
                {treeRoot.object.id === graphStore.homeRoot.id ? (
                  <HomeIcon size={20} />
                ) : isGlobalRoot ? (
                  <Globe size={20} strokeWidth={1.8} />
                ) : null}
                <TooltipTrigger asChild>
                  <div style={{ width: "100%" }}>
                    <h1 className={s.TitleText}>
                      <NodeHeaderEditor key={treeRoot.object.id} treeNode={treeRoot} />
                    </h1>
                    {settingsStore.showNodeDetails && <RootObjectDetails object={treeRoot.object} />}
                  </div>
                </TooltipTrigger>
              </div>
              <Button
                variant="default"
                className={cn(breadcrumbs.ShowTooltip, breadcrumbs.BottomAlign, s.LinkButton)}
                data-tooltip="Copy URL"
                size="icon"
                onClick={() => {
                  copyObjectUrlToClipboard(treeNodeToObjectPath(treeRoot));
                  addToast({
                    title: "Copied URL to clipboard",
                  });
                }}
              >
                <Link size={16} strokeWidth={1.7} />
              </Button>
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
      {!user.isAnonymous && (
        <div
          className={s.EmptySpaceClickArea}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Set focus to last part of final root node
            const lastNode = treeRoot.visibleChildren[treeRoot.visibleChildren.length - 1];
            // If the last node is note content, create a child at the end of the tree instead.
            if (lastNode.object.noteContentRelationsList.size > 0 || lastNode.visibleChildren.length > 0) {
              tree.createChildOfRootAndFocus({ atBottom: true });
            } else {
              tree.setFocusedNode(lastNode.path, "end");
            }
          }}
        />
      )}
    </div>
  );
}

export default observer(OutlineContent);
