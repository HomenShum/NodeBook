import { CornerDownRight, LoaderCircle, Maximize2, Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useState } from "react";

import { Checkbox } from "@/app/components/Checkbox/Checkbox";
import { PinCustomIcon } from "@/app/components/CustomIcons";
import { NoteContentPrefix } from "@/app/components/RelatedObject/NoteContentPrefix";
import { NoteContentSuffix } from "@/app/components/RelatedObject/NoteContentSuffix";
import { RelatedRelationView } from "@/app/components/RelatedObject/RelatedRelationView";
import { RelationCounter } from "@/app/components/RelatedObject/RelationCounter";
import Toggle from "@/app/components/RelatedObject/Toggle";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { env } from "@/app/envFrontend";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { isNoteContent, isUnlabelledChild, useSetMainRoot } from "@/app/tree/utils";
import { useIsMobile } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
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
    (viewType === "note" && isNoteContent(treeNode) && treeNode.parent.parent instanceof RootTreeNode) ||
    (viewType === "note" && treeNode.parent instanceof RootTreeNode);

  return (
    <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)}>
      <Main treeNode={treeNode}>
        {!(viewType === "note" && isNoteContentRoot) && <Controls showToggle={hideToggle} />}
        {!hideToggle && <Toggle />}
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
  const [isHovered, setIsHovered] = useState(false);
  const [relationComboboxIsOpen, setRelationComboboxIsOpen] = useState(false);
  const [viewType, setViewType] = useState<RelatedObjectViewType>("edit");

  return (
    <TreeNodeProvider
      value={{
        treeNode,
        relationComboboxIsOpen,
        setRelationComboboxIsOpen,
        updatingRelationType,
        setUpdatingRelationType,
        isHovered,
        setIsHovered,
        viewType,
        setViewType,
      }}
    >
      <div
        className={styles.RelatedObjectContent}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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

  return (
    <>
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
                <NoteContentSection parentNode={treeNode} group={treeNode.childrenGroupsById.noteContent} />
                <div
                  style={{
                    position: "absolute",
                    left: comboBoxWidth ? comboBoxWidth : -2,
                    top: 3,
                    width: "10px",
                    height: "20px",
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
          {/* Show pinned icon when rendering a pinned relation outside the pinned section */}
          <Button
            size="state"
            variant="ghost"
            data-tooltip={
              treeNode.parent.object.isRelationPinned(treeNode.relationWithParent) ? "Unpin node" : "Pin node"
            }
            className={cn(
              styles.PinToggle,
              treeNode.parentGroup.id === "pinned" && styles.Hidden,
              treeNode.parent.object.isRelationPinned(treeNode.relationWithParent) ? styles.Pinned : styles.Unpinned,
            )}
            onPointerDown={() => {
              const isPinned = treeNode.parent.object.isRelationPinned(treeNode.relationWithParent);
              if (isPinned) {
                treeNode.parent.object.unpinChildRelation(treeNode.relationWithParent);
              } else {
                treeNode.parent.object.pinChildRelation(treeNode.relationWithParent);
              }
            }}
          >
            <div className={styles.PinIcon}>
              <PinCustomIcon />
            </div>
          </Button>

          {/* I think not showing this in replace mode is a good option but feel free to change */}
          {viewType !== "replace" && !isNoteContentRoot && (
            <RelationCounter
              object={treeNode.object}
              onClick={() => tree.togglePathExpanded(treeNode.path)}
              showTooltip={true}
            />
          )}
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
  const { treeNode, isHovered, setUpdatingRelationType } = useTreeNode();
  const isFirstChildOfNoteContent =
    treeNode.parentGroup.id === "noteContent" && treeNode.parentGroup.nodes[0].id === treeNode.id;
  const isMobile = useIsMobile();
  const setRoot = useSetMainRoot();
  const isNoteContentRoot = treeNode.childrenGroupsById.noteContent.nodes.length > 0;

  return (
    <>
      <div className={styles.RelatedObjectLeftHandler}>
        <div className={styles.RelatedObjectActions}>
          <RelatedObjectMenu
            setUpdatingRelationType={setUpdatingRelationType}
            isHovered={isMobile ? true : isHovered}
          />
          {
            <button
              className={cn(styles.SetRootButton, (isMobile || isHovered) && styles.Hovered)}
              onPointerDown={() => setRoot(treeNode.object)}
            >
              <Maximize2 size={16} className={styles.SetRootIcon} />
            </button>
          }
          {showToggle && treeNode.childCount > 0 && !isNoteContentRoot && <Toggle />}
          {viewStore.isNodeProcessing(treeNode.object.id) && <LoadingSpinner />}
        </div>
      </div>
    </>
  );
});
