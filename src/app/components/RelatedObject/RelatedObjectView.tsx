import { CornerDownRight, Link, LoaderCircle, Maximize2, Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useState } from "react";

import { Card } from "@/app/components/Card";
import { Checkbox } from "@/app/components/Checkbox/Checkbox";
import { PinCustomIcon } from "@/app/components/CustomIcons";
import { NoteContentPrefix } from "@/app/components/RelatedObject/NoteContentPrefix";
import { NoteContentSuffix } from "@/app/components/RelatedObject/NoteContentSuffix";
import { RelatedRelationView } from "@/app/components/RelatedObject/RelatedRelationView";
import { RelationCounter } from "@/app/components/RelatedObject/RelationCounter";
import Toggle from "@/app/components/RelatedObject/Toggle";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { env } from "@/app/envFrontend";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphRelationType } from "@/app/graph/types";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { isNoteContent, isUnlabelledChild, treeNodeToObjectPath, useSetMainRoot } from "@/app/tree/utils";
import { copyObjectUrlToClipboard, useIsMobile } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
// import all constants
import { RelationTypePrefix } from "@/app/components/RelatedObject/RelationTypePrefix";
import { TypeIndicator } from "@/app/editor/plugins/dropdown/DropdownItem";
import { useToast } from "@/app/hooks/useToast";
import { ViewType } from "@/app/view/types";
import { cn } from "@/lib/utils";

import { ChildGroups, NoteContentSection } from "./ChildGroups";
import { RelatedNodeView } from "./RelatedNodeView";
import { RelatedObjectViewType, TreeNodeProvider, useTreeNode } from "./RelatedObjectContext";
import { RelatedObjectDetails } from "./RelatedObjectDetails";
import { RelatedObjectMenu } from "./RelatedObjectMenu";
import { RelationCombobox } from "./RelationCombobox/RelationCombobox";
import { ReplaceRelatedNodeView } from "./ReplaceRelatedNodeView";
import styles from "./styles/RelatedObjectView.module.css";
import stylesToggle from "./styles/Toggle.module.css";

interface Props {
  treeNode: DescendantTreeNode;
}

export const RelatedObjectView = observer(function RelatedObjectView({ treeNode }: Props) {
  const viewStore = useViewStore();
  const viewType =
    treeNode.tree instanceof QuickCaptureTree || treeNode.tree instanceof QuickCaptureSearchTree
      ? viewStore.quickCaptureViewType
      : viewStore.viewType;

  const isNoteContentRoot =
    treeNode.object.noteContentRelationsList.size > 0 && treeNode.childrenGroupsById.noteContent.nodes.length > 0;

  // node is content of a note which is a direct child of the root
  const hideToggle =
    isNoteContentRoot ||
    (viewType === ViewType.Note && isNoteContent(treeNode) && treeNode.parent.parent instanceof RootTreeNode) ||
    (viewType === ViewType.Note && treeNode.parent instanceof RootTreeNode) ||
    (viewType === ViewType.Webpage && treeNode.parent instanceof RootTreeNode && treeNode.childCount === 0);

  const fillSpaceForToggle =
    viewType === ViewType.Webpage &&
    treeNode.parent instanceof RootTreeNode &&
    treeNode.childCount === 0 &&
    treeNode.childrenGroupsById.noteContent.nodes.length === 0;
  const hasNoteContent = treeNode.childrenGroupsById.noteContent.nodes.length > 0;

  if (viewType === "card") {
    return (
      <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)}>
        <Main treeNode={treeNode}>
          <CardWrapper />
        </Main>
      </div>
    );
  }

  return (
    <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)}>
      <Main treeNode={treeNode}>
        {!(viewType === "note" && !hasNoteContent) && <Controls showToggle={hideToggle} />}
        {!hideToggle && <Toggle />}
        {fillSpaceForToggle && <div style={{ width: 16, height: 21 }} />}
        <Content />
      </Main>
      {viewType === "note" &&
        treeNode.parent instanceof RootTreeNode &&
        isNoteContentRoot &&
        treeNode.childCount > 0 && <RelationsToggle treeNode={treeNode} />}
      {treeNode.isExpanded && <ChildGroups treeNode={treeNode} />}
    </div>
  );
});

function RelationsToggle({ treeNode }: { treeNode: DescendantTreeNode }) {
  const tree = treeNode.tree;
  return (
    <Button
      size="xs"
      variant={treeNode.isExpanded ? "default" : "ghostSmooth"}
      className={cn(styles.RelatedObjectRelationsToggle, treeNode.isExpanded)}
      onPointerDown={() => {
        tree.setPathExpanded(treeNode.id, !treeNode.isExpanded);
      }}
    >
      <Play size={7} className={`${stylesToggle.Icon} ${treeNode.isExpanded ? stylesToggle.ToggleExpanded : ""}`} />
      <span>
        {treeNode.childCount} relation{treeNode.childCount === 1 ? "" : "s"}
      </span>
    </Button>
  );
}

interface MainProps {
  treeNode: DescendantTreeNode;
  children: React.ReactNode;
}

const Main = observer(function Main({ treeNode, children }: MainProps) {
  const [updatingRelationType, setUpdatingRelationType] = useState(false);
  const [relationComboboxIsOpen, setRelationComboboxIsOpen] = useState(false);
  const [viewType, setViewType] = useState<RelatedObjectViewType>("edit");
  const isMobile = useIsMobile();
  const graphStore = useGraphStore();

  if (isMobile) {
    graphStore.layerManager.lazyLoadWithIds([treeNode.object.id]);
  }

  return (
    <TreeNodeProvider
      value={{
        treeNode,
        relationComboboxIsOpen,
        setRelationComboboxIsOpen,
        updatingRelationType,
        setUpdatingRelationType,
        viewType,
        setViewType,
      }}
    >
      <div
        className={styles.RelatedObjectContent}
        onMouseEnter={() => {
          graphStore.layerManager.lazyLoadWithIds([treeNode.object.id]);
        }}
      >
        {children}
      </div>
    </TreeNodeProvider>
  );
});

const Content = observer(function Content() {
  const settingsStore = useSettingsStore();
  const {
    treeNode,
    relationComboboxIsOpen,
    setRelationComboboxIsOpen,
    updatingRelationType,
    setUpdatingRelationType,
    viewType,
  } = useTreeNode();
  const tree = treeNode.tree;
  const viewStore = useViewStore();
  const treeViewType =
    treeNode.tree instanceof QuickCaptureTree || treeNode.tree instanceof QuickCaptureSearchTree
      ? viewStore.quickCaptureViewType
      : viewStore.viewType;
  const showRelationType = !isUnlabelledChild(treeNode) || updatingRelationType;
  const [manualShowRelationType, setManualShowRelationType] = useState(false);
  const [comboBoxWidth, setComboBoxWidth] = useState(
    document.getElementById([treeNode.id, "relationCombobox"].join("-"))?.clientWidth,
  );
  const { addToast } = useToast();

  useEffect(() => {
    setComboBoxWidth(document.getElementById([treeNode.id, "relationCombobox"].join("-"))?.clientWidth);
  }, [relationComboboxIsOpen, treeNode.relationWithParent.relationType, setComboBoxWidth, treeNode.id]);

  const openRelComboBox = () => {
    setRelationComboboxIsOpen(true);
    setManualShowRelationType(true);
  };

  const nodeSelectionAnchorId = tree.selection && tree.selection.type === "node" ? tree.selection.anchorNodeId : null;
  const nodeSelectionHeadId = tree.selection && tree.selection.type === "node" ? tree.selection.headNodeId : null;

  const isMobile = useIsMobile();
  const handleTap = useCallback(() => {
    if (isMobile) {
      treeNode.tree.setFocusedNode(treeNode.path, "end", true);
    }
  }, [isMobile, treeNode]);
  const isNoteContentRoot = treeNode.object.noteContentRelationsList.size > 0;

  // Right area click handler to focus at the end of the node
  const handleRightAreaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    treeNode.tree.setFocusedNode(treeNode.id, "end", true);
  };

  // Focus handler to focus at the start of the node
  const handleLeftAreaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    treeNode.tree.setFocusedNode(treeNode.id, "start", true);
  };

  const handleBorderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.shiftKey) {
      // Open in sidebar when shift-clicked
      viewStore.createSidePanelTree(treeNode.object);
    } else {
      // Zoom into note root node when clicked
      setRoot(treeNode.object);
    }
  };

  const setRoot = useSetMainRoot();

  return (
    <>
      <div className={styles.RelatedObjectLeftHandler}>
        {/* Add clickable area to the left of the node */}
        <div className={styles.RelatedObjectLeftClickArea} onPointerDown={handleLeftAreaClick} />
        <div className={styles.RelatedObjectActions} style={{ position: "relative", zIndex: 2 }}>
          <RelatedObjectMenu setUpdatingRelationType={setUpdatingRelationType} />
          {
            <button
              className={styles.SetRootButton}
              onPointerDown={(e) => {
                if (e.shiftKey) {
                  // open in sidebar
                  viewStore.createSidePanelTree(treeNode.object);
                } else {
                  setRoot(treeNode.object);
                }
              }}
            >
              <Maximize2 size={11} className={styles.SetRootIcon} />
            </button>
          }
          {viewStore.isNodeProcessing(treeNode.object.id) && <LoadingSpinner />}
        </div>
      </div>
      <div className={cn(styles.RelatedObjectNode, tree.isNodeSelected(treeNode.id) && styles.Selected)}>
        <div className={styles.RelatedObjectNodeContent}>
          {treeNode.isTodoItem && <Checkbox node={treeNode} />}
          {(showRelationType || manualShowRelationType) && (
            <div
              id={[treeNode.id, "relationCombobox"].join("-")}
              onPointerDown={(e) => {
                if (isMobile) {
                  e.stopPropagation();
                  setRelationComboboxIsOpen(!relationComboboxIsOpen);
                }
              }}
            >
              <RelationTypePrefix treeNode={treeNode} openRelComboBox={openRelComboBox} />
              {treeViewType === "note" &&
                treeNode.object.noteContentRelationsList.size === 0 && // Notecontent is empty
                treeNode.parent instanceof RootTreeNode &&
                !isUnlabelledChild(treeNode) && <CornerDownRight size={16} className={styles.ElbowArrow} />}
              <RelationCombobox
                setUpdatingRelationType={setUpdatingRelationType}
                treeNode={treeNode}
                isOpen={relationComboboxIsOpen}
                setIsOpen={setRelationComboboxIsOpen}
                setShowRelationType={setManualShowRelationType}
              />
            </div>
          )}
          <div onPointerDown={handleTap} style={{ width: "100%" }}>
            {treeNode.object.noteContentRelationsList.size > 0 ? (
              <div
                className={cn(
                  styles.NoteContentSection,
                  treeNode.parent instanceof RootTreeNode && treeViewType === "note" && styles.ChildOfRootInNoteView,
                )}
                id={treeNode.id + "-noteContent"}
              >
                {/* Border elements for click handling */}
                <div className={styles.BorderTop} onPointerDown={handleBorderClick} />
                <div className={styles.BorderRight} onPointerDown={handleBorderClick} />
                <div className={styles.BorderBottom} onPointerDown={handleBorderClick} />
                <div className={styles.BorderLeft} onPointerDown={handleBorderClick} />

                <NoteContentSection parentNode={treeNode} group={treeNode.childrenGroupsById.noteContent} />
                <div
                  style={{
                    position: "absolute",
                    left: comboBoxWidth ? comboBoxWidth : -2,
                    top: 3,
                  }}
                >
                  <NoteContentPrefix treeNode={treeNode} openRelComboBox={openRelComboBox} />
                </div>
              </div>
            ) : viewType === "replace" ? (
              <ReplaceRelatedNodeView treeNode={treeNode} />
            ) : treeNode.object.objectType === "node" ? (
              <RelatedNodeView treeNode={treeNode} />
            ) : treeNode.object.objectType === "relation" ? (
              <RelatedRelationView treeNode={treeNode} />
            ) : treeNode.object.objectType === "placeholder" ? (
              <span>(Private)</span>
            ) : (
              <>{treeNode.object satisfies never}</>
            )}
          </div>
        </div>
        {settingsStore.showNodeDetails && viewType !== "replace" && (
          <RelatedObjectDetails
            position={treeNode.position}
            object={treeNode.object}
            relation={treeNode.relationWithParent}
          />
        )}
      </div>
      <div>
        {
          // Check for note content
          treeViewType === "outline" && treeNode.object.noteContentRelationsList.size > 0 && (
            <div
              style={{ width: "10%", height: "100%", position: "absolute", cursor: "text" }}
              onClick={() => {
                const suffixInput = document.querySelector(`[data-note-suffix="${treeNode.object.id}"]`);
                if (suffixInput && suffixInput instanceof HTMLInputElement) {
                  suffixInput.focus();
                } else {
                  throw new Error("Prefix input not found");
                }
              }}
              // On click, set focus to noteContentSuffix
            >
              <NoteContentSuffix treeNode={treeNode} />
            </div>
          )
        }
        <div className={styles.RelatedObjectRightArea}>
          {viewType !== "replace" && !isNoteContentRoot && treeNode.object.relations.length <= 1 && (
            <div style={{ width: 18, height: 18 }} />
          )}
          <Button
            size="state"
            variant="ghost"
            data-tooltip="Copy URL"
            className={cn(styles.ObjectRightToggle, styles.CopyURLButton)}
            onPointerDown={async () => {
              await copyObjectUrlToClipboard(treeNodeToObjectPath(treeNode));
              addToast({
                title: "Copied node URL to clipboard",
              });
            }}
          >
            <div className={styles.CopyURLIcon}>
              <Link size={14} />
            </div>
          </Button>
          {/* Show pinned icon when rendering a pinned relation outside the pinned section */}
          <Button
            size="state"
            variant="ghost"
            data-tooltip={
              treeNode.parent.object.isRelationPinned(treeNode.relationWithParent) ? "Unpin node" : "Pin node"
            }
            className={cn(
              styles.ObjectRightToggle,
              treeNode.parentGroup.id === "pinned" && styles.Hidden,
              treeNode.parent.object.isRelationPinned(treeNode.relationWithParent) ? styles.Pinned : styles.Unpinned,
            )}
            onPointerDown={() => {
              // Store current focus state
              const previousSelection = tree.selection;

              const isPinned = treeNode.parent.object.isRelationPinned(treeNode.relationWithParent);
              if (isPinned) {
                treeNode.parent.object.unpinChildRelation(treeNode.relationWithParent);
              } else {
                treeNode.parent.object.pinChildRelation(treeNode.relationWithParent);
              }

              // Restore focus after the operation
              if (previousSelection?.type === "editor") {
                tree.setFocusedNode(
                    previousSelection.treeNodeId,
                    previousSelection.position,
                    previousSelection.editMode
                );

                // Force DOM focus after React updates
                setTimeout(() => {
                  const editorElement = document.querySelector(`[data-editor-path="${previousSelection.treeNodeId}"]`) as HTMLElement;
                  if (editorElement) {
                    editorElement.focus();
                  }
                }, 0);
              }
            }}
          >
            <div className={styles.PinIcon}>
              <PinCustomIcon />
            </div>
          </Button>
          <TypeIndicator object={treeNode.object} />
          {env.env !== "production" && (
            <>
              {treeNode.id === nodeSelectionAnchorId && (
                <div title="Anchor" className={styles.RelationCounter}>
                  A
                </div>
              )}
              {treeNode.id === nodeSelectionHeadId && (
                <div title="Head" className={styles.RelationCounter}>
                  H
                </div>
              )}
            </>
          )}
          {viewType !== "replace" && !isNoteContentRoot && (
            <RelationCounter
              object={treeNode.object}
              onClick={() => tree.togglePathExpanded(treeNode.path)}
              showTooltip={true}
            />
          )}

          {/* Add right click area for focusing at the end of the node */}
          <div className={styles.RelatedObjectRightClickArea} onPointerDown={handleRightAreaClick} />
        </div>
      </div>
    </>
  );
});

const LoadingSpinner = () => {
  return (
    <div className={styles.LoadingSpinner}>
      <LoaderCircle size={16} />
    </div>
  );
};

const Controls = observer(function Controls({ showToggle }: { showToggle: boolean }) {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const { treeNode, setUpdatingRelationType } = useTreeNode();

  const isMobile = useIsMobile();

  const setRoot = useSetMainRoot();
  const isNoteContentRoot = treeNode.childrenGroupsById.noteContent.nodes.length > 0;

  const handleTap = useCallback(() => {
    if (isMobile) {
      treeNode.tree.setFocusedNode(treeNode.path, "end", true);
    }
  }, [isMobile, treeNode]);

  return (
    <>
      <div className={styles.RelatedObjectLeftHandler}>
        <div className={styles.RelatedObjectActions} style={{ position: "relative", zIndex: 2 }}>
          <RelatedObjectMenu setUpdatingRelationType={setUpdatingRelationType} />
          {
            <button
              className={cn(styles.SetRootButton)}
              onPointerDown={(e) => {
                if (e.shiftKey) {
                  // open in sidebar
                  viewStore.createSidePanelTree(treeNode.object);
                } else {
                  setRoot(treeNode.object);
                }
              }}
            >
              <Maximize2 size={11} className={styles.SetRootIcon} />
            </button>
          }
          {showToggle && treeNode.childCount > 0 && !isNoteContentRoot && <Toggle />}
          {viewStore.isNodeProcessing(treeNode.object.id) && <LoadingSpinner />}
        </div>
      </div>
    </>
  );
});

const CardWrapper = observer(() => {
  const { treeNode } = useTreeNode();
  const graphStore = useGraphStore();
  const graphObject = treeNode.object;
  const setRoot = useSetMainRoot();
  const { addToast } = useToast();

  const getAuthorName = (authorId: string) => {
    if (graphObject.authorId === userId) {
      return "You";
    }

    return graphStore.usersById.get(authorId)?.username || authorId;
  };

  const countChildrenOfType = (relationType: GraphRelationType) => {
    return graphObject.allRelationsList
      .values()
      .filter(({ item }) => item.relationType.id === relationType.id && item.from.id === graphObject.id).length;
  };

  const userId = graphStore.user?.id;
  const userHomeNodeId = graphStore.homeRoot.id;

  const nodeRelations = graphObject.allRelationsList
    .values()
    .filter(({ item }) => {
      const relationTypeId = item.relationType.id;
      return (
        item.from.id === graphObject.id &&
        relationTypeId !== defaultRelationTypes.__comment__.id &&
        relationTypeId !== defaultRelationTypes.__liked_by__.id &&
        relationTypeId !== defaultRelationTypes.__status__.id
      );
    })
    .map(({ item }) => ({
      id: item.to.id,
      text: item.to.text,
    }));

  const statusRelation = graphObject.allRelationsList
    .values()
    .find(({ item }) => item.relationType.id === defaultRelationTypes.__status__.id);

  const { cardStatusesNode } = graphStore;

  const configuredStatusTypes = cardStatusesNode.children.map((item) => item.text);

  const currentStatusIndex = statusRelation
    ? configuredStatusTypes.findIndex((type) => type === statusRelation.item.to.text)
    : 0;

  const cycleStatus = async () => {
    const newIndex = (currentStatusIndex + 1) % configuredStatusTypes.length;

    const newStatusNode = cardStatusesNode.children.find(
      (relation) => relation.text === configuredStatusTypes[newIndex],
    );

    if (!newStatusNode) {
      console.error("Could not find status node for text:", configuredStatusTypes[newIndex]);
      return;
    }

    if (statusRelation) {
      graphStore.replaceRelationLink({
        relationId: statusRelation.item.id,
        direction: "to",
        replaceWith: { type: "existing-object", id: newStatusNode.id },
      });
    } else {
      graphStore.addRelation({
        fromId: graphObject.id,
        toId: newStatusNode.id,
        relationTypeId: defaultRelationTypes.__status__.id,
      });
    }
  };

  const likeCount = countChildrenOfType(defaultRelationTypes.__liked_by__);

  const userLikeRelation = graphObject.allRelationsList
    .values()
    .find(
      ({ item }) =>
        item.relationType.id === defaultRelationTypes.__liked_by__.id &&
        item.from.id === graphObject.id &&
        item.to.id === userHomeNodeId,
    );

  const toggleLike = () => {
    if (userLikeRelation) {
      graphStore.removeRelation({ relationId: userLikeRelation.item.id });
    } else {
      graphStore.addRelation({
        fromId: graphObject.id,
        toId: userHomeNodeId,
        relationTypeId: defaultRelationTypes.__liked_by__.id,
      });
    }
  };

  const handleCommentSubmit = async (text: string) => {
    const commentNode = await graphStore.addNode({
      nodeProps: {
        content: [{ type: "text", value: text }],
      },
    });

    await graphStore.addRelation({
      fromId: graphObject.id,
      toId: commentNode.id,
      relationTypeId: defaultRelationTypes.__comment__.id,
    });
  };

  const handleTextChange = async (text: string) => {
    graphStore.updateNode({
      nodeId: graphObject.id,
      nodeProps: {
        content: [{ type: "text", value: text }],
      },
    });
  };

  const handleAddRelation = async (text: string) => {
    const newNode = await graphStore.addNode({
      nodeProps: {
        content: [{ type: "text", value: text }],
      },
    });

    graphStore.addRelation({
      fromId: graphObject.id,
      toId: newNode.id,
      relationTypeId: defaultRelationTypes.empty.id,
    });
  };

  // Check if this node is already in My Stream
  const isSavedToStream = !!graphStore.myStreamNode.relations.find((relation) => relation.to.id === graphObject.id);

  // Function to add the node to My Stream
  const saveToMyStream = async () => {
    if (!isSavedToStream) {
      await graphStore.addRelation({
        fromId: graphStore.myStreamNodeId,
        toId: graphObject.id,
      });

      // Add "#saved" tag to the node text if it doesn't already have it
      if (!graphObject.text.includes("#saved")) {
        const updatedText = graphObject.text + (graphObject.text ? " #saved" : "#saved");
        graphStore.updateNode({
          nodeId: graphObject.id,
          nodeProps: {
            content: [{ type: "text", value: updatedText }],
          },
        });
      }

      // Show toast notification when saved
      addToast({
        title: "Saved to My Stream",
        duration: 3000,
      });
    } else {
      // If already saved, find and remove the relation
      const relationToRemove = graphStore.myStreamNode.relations.find((relation) => relation.to.id === graphObject.id);
      if (relationToRemove) {
        await graphStore.removeRelation({
          relationId: relationToRemove.id,
        });

        // Remove "#saved" tag from the node text
        if (graphObject.text.includes("#saved")) {
          const updatedText = graphObject.text
            .replace(" #saved", "") // Remove with space before
            .replace("#saved ", "") // Remove with space after
            .replace("#saved", ""); // Remove without spaces

          graphStore.updateNode({
            nodeId: graphObject.id,
            nodeProps: {
              content: [{ type: "text", value: updatedText }],
            },
          });
        }

        // Show toast notification when removed from My Stream
        addToast({
          title: "Removed from My Stream",
          duration: 3000,
        });
      }
    }
  };

  const commentsList = graphObject.allRelationsList
    .values()
    .filter(
      ({ item }) => item.relationType.id === defaultRelationTypes.__comment__.id && item.from.id === graphObject.id,
    )
    .map(({ item }) => {
      const commentLikeRelations = item.to.allRelationsList
        .values()
        .filter(
          ({ item: likeItem }) =>
            likeItem.relationType.id === defaultRelationTypes.__liked_by__.id && likeItem.from.id === item.to.id,
        );

      const userLikeRelation = commentLikeRelations.find(({ item: likeItem }) => likeItem.to.id === userHomeNodeId);

      const toggleCommentLike = () => {
        if (userLikeRelation) {
          graphStore.removeRelation({ relationId: userLikeRelation.item.id });
        } else {
          graphStore.addRelation({
            fromId: item.to.id,
            toId: userHomeNodeId,
            relationTypeId: defaultRelationTypes.__liked_by__.id,
          });
        }
      };

      return {
        id: item.to.id,
        text: item.to.text,
        author: {
          id: item.to.authorId,
          name: getAuthorName(item.to.authorId),
        },
        time: item.createdAt,
        likes: commentLikeRelations.length,
        isLiked: userLikeRelation != null,
        onLikeClicked: toggleCommentLike,
      };
    });

  const handleRelationClick = (id: string) => {
    const node = graphStore.nodesById.get(id);
    if (node) {
      setRoot(node);
    }
  };

  return (
    <Card
      author={{
        id: graphObject.authorId,
        name: getAuthorName(graphObject.authorId),
      }}
      status={configuredStatusTypes[currentStatusIndex]}
      onStatusClicked={cycleStatus}
      relations={nodeRelations}
      likes={likeCount}
      isLiked={userLikeRelation != null}
      onLikeClicked={toggleLike}
      onCommentSubmit={handleCommentSubmit}
      onTextChange={handleTextChange}
      onAddRelation={handleAddRelation}
      onRelationClick={handleRelationClick}
      onSaveClicked={saveToMyStream}
      isSaved={isSavedToStream}
      commentsList={commentsList}
      initialIsEditing={graphObject.text === ""}
    >
      {graphObject.text}
    </Card>
  );
});
