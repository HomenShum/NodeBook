import { Globe, HomeIcon, Link, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useContext, useEffect, useMemo, useRef } from "react";

import appStyles from "@/app/app.module.css";
import { ClickToCreateNodeButton } from "@/app/components/Buttons/ClickToCreateNodeButton";
import { Checkbox } from "@/app/components/Checkbox/Checkbox";
import { FlattenIcon, SublistsIcon } from "@/app/components/CustomIcons";
import s from "@/app/components/OutlineView.module.css";
import { ChildGroups, NoteContentSection } from "@/app/components/RelatedObject/ChildGroups";
import { NodeHeaderSettingsMenu } from "@/app/components/RelatedObject/NodeHeaderSettingsMenu";
import { RootObjectDetails } from "@/app/components/RelatedObject/RelatedObjectDetails";
import { Button } from "@/app/components/UIPrimitives/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { OutlineParentContext } from "@/app/contexts/OutlineContentContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useSlugs } from "@/app/contexts/SlugContext";
import { useUser } from "@/app/contexts/UserContext";
import { NodeHeaderEditor } from "@/app/editor/NodeHeaderEditor";
import { AccessMode, GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { getCanonicalPath, objectPathToBreadcrumb } from "@/app/graph/utils";
import { useToast } from "@/app/hooks/useToast";
import { handleTreeHotkeys, isEscapeSelectionHotkey, isZoomInHotkey, isZoomOutHotkey } from "@/app/hotkeys";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";
import { SearchTree } from "@/app/tree/SearchTree";
import { Tree } from "@/app/tree/Tree";
import { treeNodeToObjectPath, useSetMainRoot } from "@/app/tree/utils";
import { copyObjectUrlToClipboard } from "@/app/util";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import breadcrumbs from "./Breadcrumbs/Breadcrumbs.module.css";
import relatedObjectStyles from "./RelatedObject/styles/RelatedObjectView.module.css";

interface Props {
  tree: Tree;
}

const RelationHeader = observer(function RelationHeader({ relation }: { relation: GraphRelation }) {
  const setRoot = useSetMainRoot();
  const customTypeRelation = relation.customTypeRelation;

  return (
    <div className={s.RelationHeader}>
      <div className={s.RelationObjects}>
        From:
        <span className={s.RelationObject} onClick={() => setRoot(relation.from)}>
          {relation.from.text.length < 14 ? relation.from.text : `${relation.from.text.slice(0, 10)}(...)`}
        </span>
        To:
        <span className={s.RelationObject} onClick={() => setRoot(relation.to)}>
          {relation.to.text.length < 14 ? relation.to.text : `${relation.to.text.slice(0, 10)}(...)`}
        </span>
      </div>
      <div className={s.RelationObjects}>
        Relation Type:
        <div
          className={s.RelationType}
          style={{ cursor: customTypeRelation ? "pointer" : "default" }}
          onClick={() => (customTypeRelation ? setRoot(customTypeRelation.to) : null)}
        >
          {relation.relationType.label}
        </div>
      </div>
    </div>
  );
});

function OutlineContent({ tree }: Props) {
  const treeRoot = tree.state.root;
  const graphStore = useGraphStore();
  const user = useUser();
  const viewStore = useViewStore();
  const settingsStore = useSettingsStore();
  const { addToast } = useToast();
  const setRoot = useSetMainRoot();
  const { slugs } = useSlugs();
  const elementRef = useRef<HTMLDivElement>(null);
  const allowAnonymousAppend = treeRoot.object instanceof GraphNode && treeRoot.object.accessMode === AccessMode.APPEND;

  const userId = graphStore.user?.id;
  const isGlobalRoot = treeRoot.object.id === graphStore.globalRoot.id;

  // Check if the main root is loading (has incomplete relation data)
  let isMainRootLoading = false;
  // if (treeRoot.object instanceof GraphNode) {
  //   const totalRelations = treeRoot.object.relationCount;
  //   const loadedRelations = treeRoot.object.relations.length;
  //   isMainRootLoading = totalRelations > loadedRelations;
  // }

  const tooltipContent = useMemo(() => {
    const authorId = treeRoot.object.authorId;
    const authorName = authorId === userId ? "You" : graphStore.usersById.get(authorId)?.username || authorId;
    const path = getCanonicalPath(treeRoot.object);
    const breadcrumbs = objectPathToBreadcrumb(path);

    return isGlobalRoot ? null : (
      <>
        <div className={s.TooltipContent}>Node&apos;s author: {authorName}</div>
        <div className={s.TooltipContent}>Created: {new Date(treeRoot.object.createdAt).toLocaleDateString()}</div>
        <div className={s.TooltipContent}>{breadcrumbs.join(" / ")}</div>
      </>
    );
  }, [isGlobalRoot, treeRoot.object, userId, graphStore]);

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

  const parentComponent = useContext(OutlineParentContext);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      let wasEventHandled = false;
      if (viewStore.quickCaptureOpen && isEscapeSelectionHotkey(event)) {
        wasEventHandled = true;
        viewStore.closeQuickCapture();
        viewStore.setActiveTree(viewStore.mainView);
        const topChild =
          viewStore.mainView.root.childrenGroupsById.all.nodes[0] ?? viewStore.mainView.createChildOfRootAndFocus();
        viewStore.mainView.setFocusedNode(topChild.path, "end", true, true);
      }
      if (tree.isMainTree && tree.selection === null && isEscapeSelectionHotkey(event)) {
        wasEventHandled = true;
        setRoot(graphStore.getDefaultRootForUser());
        viewStore.setViewType(ViewType.Outline);
      }
      if (!wasEventHandled) {
        wasEventHandled = handleTreeHotkeys(event, tree, addToast);
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

    // Custom event handler for double Cmd+A
    const handleDoubleCommandA = (event: CustomEvent) => {
      if (viewStore.activeTree.id === tree.id) {
        const focusedNode = tree.selectionWithNodes?.type === "editor" ? tree.selectionWithNodes.treeNode : null;

        if (focusedNode) {
          // If in multiline note, select the whole note
          if (focusedNode.parentGroup?.id === "noteContent") {
            const noteNodes = focusedNode.parent.childrenGroupsById.noteContent.nodes;
            const firstNode = noteNodes[0];
            const lastNode = noteNodes[noteNodes.length - 1];
            tree.selectBetween(firstNode.id, lastNode.id);
          } else {
            // Otherwise select all nodes on the page
            const allNodes = tree.state.root.childrenGroupsById.all.nodes;
            if (allNodes.length > 0) {
              tree.selectBetween(allNodes[0].id, allNodes[allNodes.length - 1].id);
            }
          }
        }
      }
    };

    const handleFocus = () => {
      viewStore.setActiveTree(tree);
    };

    const element = elementRef.current;
    element && element.addEventListener("keydown", handleKeyDown);
    element && element.addEventListener("focusin", handleFocus);

    // Add the event listener at the document level
    document.addEventListener("doubleCommandA", handleDoubleCommandA as EventListener);

    return () => {
      element && element.removeEventListener("keydown", handleKeyDown);
      element && element.removeEventListener("focusin", handleFocus);

      // Remove the event listener from the document
      document.removeEventListener("doubleCommandA", handleDoubleCommandA as EventListener);
    };
  });

  const hideHeader =
    ((tree.isMainTree || (tree instanceof SearchTree && !(tree instanceof QuickCaptureSearchTree))) &&
      viewStore.viewType === ViewType.Note) ||
    ((tree instanceof QuickCaptureTree || tree instanceof QuickCaptureSearchTree) &&
      viewStore.quickCaptureViewType === ViewType.Note);

  return (
    <div
      id={tree.id}
      tabIndex={-1}
      data-scroll-id={"ContentContainer"}
      className={cn(
        appStyles.ContentContainer,
        (tree.isMainTree || (tree instanceof SearchTree && tree.isMainSearchTree)) &&
          viewStore.quickCaptureOpen &&
          !viewStore.rightSidePanelOpen
          ? appStyles.SmallContainer
          : "",
      )}
      ref={elementRef}
    >
      {!hideHeader && (
        <div className={s.HeadingContainer}>
          <div className={s.TitleContainer}>
            <div className={s.HeadingLeftHandler}>
              <NodeHeaderSettingsMenu treeNode={treeRoot} />
            </div>
            <TooltipProvider>
              {!isGlobalRoot ? (
                <Tooltip>
                  <div className={s.IconAndTitle}>
                    {treeRoot.object.id === graphStore.homeRoot.id ? (
                      <HomeIcon size={20} />
                    ) : isGlobalRoot ? (
                      <Globe size={20} strokeWidth={1.8} />
                    ) : null}
                    <TooltipTrigger asChild>
                      <div style={{ width: "100%" }}>
                        <h1 className={cn(s.TitleText, isMainRootLoading && relatedObjectStyles.Loading)}>
                          {treeRoot.isTodoItem && <Checkbox node={treeRoot} />}
                          <NodeHeaderEditor key={treeRoot.object.id} treeNode={treeRoot} />
                        </h1>
                        {settingsStore.showNodeDetails && <RootObjectDetails object={treeRoot.object} />}
                      </div>
                    </TooltipTrigger>
                  </div>
                  <TooltipContent align="start" side="bottom">
                    {tooltipContent}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className={s.IconAndTitle}>
                  <Globe size={20} strokeWidth={1.8} />
                  <div style={{ width: "100%" }}>
                    <h1 className={cn(s.TitleText, isMainRootLoading && relatedObjectStyles.Loading)}>
                      {treeRoot.isTodoItem && <Checkbox node={treeRoot} />}
                      <NodeHeaderEditor key={treeRoot.object.id} treeNode={treeRoot} />
                    </h1>
                    {settingsStore.showNodeDetails && <RootObjectDetails object={treeRoot.object} />}
                  </div>
                </div>
              )}
            </TooltipProvider>
            {parentComponent !== "RightSidePanel" && (
              <Button
                variant={viewStore.flattenSublists ? "active" : "default"}
                className={cn(breadcrumbs.ShowTooltip, breadcrumbs.BottomAlign, s.LinkButton)}
                data-tooltip={viewStore.flattenSublists ? "Expand Sublists" : "Flatten Sublists"}
                size="icon"
                onClick={() => viewStore.setFlattenSublists(!viewStore.flattenSublists)}
              >
                {viewStore.flattenSublists ? <FlattenIcon /> : <SublistsIcon />}
              </Button>
            )}
            <Button
              variant="default"
              className={cn(breadcrumbs.ShowTooltip, breadcrumbs.BottomAlign, s.LinkButton)}
              data-tooltip="Copy URL"
              size="icon"
              onClick={() => {
                if (slugs[treeRoot.object.id]) {
                  navigator.clipboard.writeText(`${window.location.origin}/${slugs[treeRoot.object.id]}`);
                } else {
                  copyObjectUrlToClipboard(treeNodeToObjectPath(treeRoot));
                }
                addToast({
                  title: "Copied page URL to clipboard",
                });
              }}
            >
              <Link size={16} strokeWidth={1.7} />
            </Button>
            {parentComponent === "RightSidePanel" && (
              <Button
                variant="default"
                className={cn(breadcrumbs.ShowTooltip, breadcrumbs.BottomAlign, s.LinkButton)}
                data-tooltip="Close Tree"
                size="icon"
                onClick={() => viewStore.deleteSidePanelTree(tree.id)}
              >
                <X size={20} strokeWidth={1.7} />
              </Button>
            )}
          </div>
          {treeRoot.object.noteContentRelationsList.size > 0 && (
            <div className={s.NoteContentSection}>
              <NoteContentSection parentNode={treeRoot} group={treeRoot.childrenGroupsById.noteContent} />
            </div>
          )}
          {treeRoot.object instanceof GraphRelation && <RelationHeader relation={treeRoot.object} />}
        </div>
      )}
      <div className={s.Nodes}>
        <ChildGroups treeNode={treeRoot} />
        {(!user.isAnonymous || allowAnonymousAppend) && treeRoot.childCount === 0 && (
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
          className={cn(
            s.EmptySpaceClickArea,
            parentComponent === "RightSidePanel" && s.EmptySpaceClickAreaInSidePanel,
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Set focus to last part of final root node
            const lastNode = treeRoot.visibleChildren[treeRoot.visibleChildren.length - 1];
            // If the last node is note content, create a child at the end of the tree instead.
            if (!lastNode || lastNode.object.noteContentRelationsList.size > 0 || lastNode.visibleChildren.length > 0) {
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
