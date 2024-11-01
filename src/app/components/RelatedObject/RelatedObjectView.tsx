import { Circle, Dot, Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useState } from "react";

import { PinCustomIcon } from "@/app/components/CustomIcons";
import { RelatedRelationView } from "@/app/components/RelatedObject/RelatedRelationView";
import { RelationCounter } from "@/app/components/RelatedObject/RelationCounter";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { env } from "@/app/envFrontend";
import { useTree } from "@/app/tree/TreeContext";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { getAncestorsAsArray, isNoteContent, isUnlabelledChild, useSetRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import { ChildGroups, NoteContentSection } from "./ChildGroups";
import { RelatedNodeView } from "./RelatedNodeView";
import { RelatedObjectViewType, TreeNodeProvider, useTreeNode } from "./RelatedObjectContext";
import { RelatedObjectDetails } from "./RelatedObjectDetails";
import { RelatedObjectMenu } from "./RelatedObjectMenu";
import { RelationCombobox } from "./RelationCombobox/RelationCombobox";
import { ReplaceRelatedNodeView } from "./ReplaceRelatedNodeView";
import Toggle from "./Toggle";
import styles from "./styles/RelatedObjectView.module.css";
import stylesToggle from "./styles/Toggle.module.css";

interface Props {
  treeNode: DescendantTreeNode;
}

export const RelatedObjectView = observer(function RelatedObjectView({ treeNode }: Props) {
  const viewStore = useViewStore();
  const hideBullet =
    viewStore.viewType === "note" &&
    // node is a direct child of the root
    (treeNode.parent instanceof RootTreeNode ||
      // or node is content of a note which is a direct child of the root
      (isNoteContent(treeNode) && treeNode.parent.parent instanceof RootTreeNode));

  return (
    <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)}>
      <Main treeNode={treeNode}>
        <Controls />
        {!hideBullet && <Bullet />}
        <Content />
      </Main>
      {viewStore.viewType === "note" && treeNode.parent instanceof RootTreeNode && treeNode.childCount > 0 && (
        <RelationsToggle treeNode={treeNode} />
      )}
      {treeNode.isExpanded && <ChildGroups treeNode={treeNode} />}
    </div>
  );
});

function RelationsToggle({ treeNode }: { treeNode: DescendantTreeNode }) {
  const tree = useTree();
  return (
    <Button
      size="xs"
      variant={treeNode.isExpanded ? "default" : "ghostSmooth"}
      className={cn(
        styles.RelatedObjectRelationsToggle,
        treeNode.isExpanded && styles.RelatedObjectRelationsToggleExpanded,
      )}
      onClick={() => {
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
  const tree = useTree();
  const {
    treeNode,
    relationComboboxIsOpen,
    setRelationComboboxIsOpen,
    updatingRelationType,
    setUpdatingRelationType,
    viewType,
  } = useTreeNode();
  const viewStore = useViewStore();
  const showRelationType = !isUnlabelledChild(treeNode) || updatingRelationType;

  const nodeSelectionAnchorId = tree.selection && tree.selection.type === "node" ? tree.selection.anchorNodeId : null;
  const nodeSelectionHeadId = tree.selection && tree.selection.type === "node" ? tree.selection.headNodeId : null;

  return (
    <>
      <div className={cn(styles.RelatedObjectNode, tree.isNodeSelected(treeNode.id) && styles.Selected)}>
        <div className={styles.RelatedObjectNodeContent}>
          {showRelationType && (
            <RelationCombobox
              setUpdatingRelationType={setUpdatingRelationType}
              treeNode={treeNode}
              isOpen={relationComboboxIsOpen}
              setIsOpen={setRelationComboboxIsOpen}
            />
          )}
          {treeNode.object.noteContentRelationsList.size > 0 ? (
            <div
              className={cn(
                styles.NoteContentSection,
                treeNode.parent instanceof RootTreeNode &&
                  viewStore.viewType === "note" &&
                  styles.ChildOfRootInNoteView,
              )}
            >
                {/* {treeNode.object.text && (
                  <div className={cn(viewStore.viewType === "note" ? styles.NoteContentSectionHeader : styles.HeaderInListView)}>
                    <NodeHeaderEditor treeNode={treeNode} noteTitle={treeNode.object.text} />
                  </div>
                )} */}
              <NoteContentSection parentNode={treeNode} group={treeNode.childrenGroupsById.noteContent} />
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
        {settingsStore.showNodeDetails && viewType !== "replace" && (
          <RelatedObjectDetails
            position={treeNode.position}
            object={treeNode.object}
            relation={treeNode.relationWithParent}
          />
        )}
      </div>
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
          onClick={() => {
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
        {viewType !== "replace" && (
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
    </>
  );
});

const Bullet = observer(function Bullet() {
  const graphStore = useGraphStore();
  const userId = graphStore.user?.id;
  const { treeNode } = useTreeNode();
  const setRoot = useSetRoot();
  const handleBulletClick = useCallback(() => {
    logger.debug("Clicked bullet", treeNode.path);
    setRoot({
      object: treeNode.object,
      relations: getAncestorsAsArray(treeNode).map((node) => node.relationToChild),
    });
  }, [treeNode, setRoot]);

  const getAuthorName = (authorId: string) => {
    return graphStore.usersById.get(authorId)?.username || authorId;
  };

  const tooltipContent = `Node's author: ${
    treeNode.object.authorId === userId ? "You" : getAuthorName(treeNode.object.authorId)
  }
    Relation author: ${
      treeNode.relationWithParent.authorId === userId ? "You" : getAuthorName(treeNode.relationWithParent.authorId)
    }
    Created: ${new Date(treeNode.object.createdAt).toLocaleDateString()}
  `;

  const isEmpty = !treeNode.object.text.trim();
  const hasChildren = treeNode.childCount > 0;

  return (
    <div
      className={cn(styles.RelatedObjectBulletContainer, isEmpty && !hasChildren && styles.Hidden)}
      data-tooltip={tooltipContent}
    >
      {treeNode.instanceCountInPath <= 1 ? (
        // Default solid bullet
        <>
          <Dot
            strokeWidth={5}
            height={16}
            className={cn(styles.Bullet, {
              [styles.DotInsidePublic]: treeNode.object.isPublic,
              [styles.DotInsidePrivate]: !treeNode.object.isPublic,
            })}
            onClick={handleBulletClick}
          />
          {hasChildren && !treeNode.isExpanded && (
            // with a shadow around it if it has children
            <Dot
              height={16}
              strokeWidth={17}
              className={cn(styles.BulletShadow, {
                [styles.DotOutsidePublic]: treeNode.object.isPublic,
                [styles.DotOutsidePrivate]: !treeNode.object.isPublic,
              })}
            />
          )}
        </>
      ) : (
        // Hollow circle if this node has appeared in the path more than once
        <Circle
          strokeWidth={6}
          height={8}
          className={cn(styles.Circle, { [styles.CirclePrivate]: !treeNode.object.isPublic })}
          onClick={handleBulletClick}
        />
      )}
    </div>
  );
});

const Controls = observer(function Controls() {
  const { treeNode, isHovered, setUpdatingRelationType } = useTreeNode();
  return (
    <>
      <div className={styles.RelatedObjectLeftHandler}>
        <div className={styles.RelatedObjectActions}>
          <RelatedObjectMenu setUpdatingRelationType={setUpdatingRelationType} isHovered={isHovered} />
          {treeNode.childCount > 0 && <Toggle treeNode={treeNode} isHovered={isHovered} />}
        </div>
      </div>
    </>
  );
});
