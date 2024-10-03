import { Circle, Dot } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useState } from "react";

import { PinCustomIcon } from "@/app/components/CustomIcons";
import { RelatedRelationView } from "@/app/components/RelatedObject/RelatedRelationView";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useTree } from "@/app/tree/TreeContext";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { getAncestorsAsArray, isUnlabelledChild, useSetRoot } from "@/app/tree/utils";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import { ChildGroups } from "./ChildGroups";
import { RelatedNodeView } from "./RelatedNodeView";
import { RelatedObjectViewType, TreeNodeProvider, useTreeNode } from "./RelatedObjectContext";
import { RelatedObjectDetails } from "./RelatedObjectDetails";
import { RelatedObjectMenu } from "./RelatedObjectMenu";
import { RelationCombobox } from "./RelationCombobox";
import { ReplaceRelatedNodeView } from "./ReplaceRelatedNodeView";
import Toggle from "./Toggle";
import styles from "./styles/RelatedObjectView.module.css";

export const RelatedObjectView = observer(
  ({ treeNode, showBullet = true }: { treeNode: DescendantTreeNode; showBullet?: boolean }) => {
    return (
      <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)}>
        <Main treeNode={treeNode}>
          <Controls />
          {showBullet && <Bullet />}
          <Content />
        </Main>
        {treeNode.isExpanded && <ChildGroups treeNode={treeNode} />}
      </div>
    );
  },
);

const Main = observer(({ treeNode, children }: { treeNode: DescendantTreeNode; children: React.ReactNode }) => {
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

const Content = observer(() => {
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
  const showRelationType = !isUnlabelledChild(treeNode) || updatingRelationType;

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
          {viewType === "replace" ? (
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
        {treeNode.parentGroup.id !== "pinned" &&
          treeNode.parent.object.isRelationPinned(treeNode.relationWithParent) && (
            <button
              className={styles.PinIcon}
              onClick={() => treeNode.parent.object.unpinChildRelation(treeNode.relationWithParent)}
            >
              <PinCustomIcon />
            </button>
          )}
        {treeNode.object.relations.length > 1 && (
          <div title="Direct relations" className={styles.RelationCounter}>
            {treeNode.object.relations.length - 1}
          </div>
        )}
      </div>
    </>
  );
});

const Bullet = observer(() => {
  const userId = useGraphStore().user?.id;
  const { treeNode } = useTreeNode();
  const setRoot = useSetRoot();
  const handleBulletClick = useCallback(() => {
    logger.debug("Clicked bullet", treeNode.path);
    setRoot({
      object: treeNode.object,
      relations: getAncestorsAsArray(treeNode).map((node) => node.relationToChild),
    });
  }, [treeNode, setRoot]);

  const tooltipContent = [
    `Object author: ${treeNode.object.authorId === userId ? "You" : treeNode.object.authorId}`,
    `Relation author: ${
      treeNode.relationWithParent.authorId === userId ? "You" : treeNode.relationWithParent.authorId
    }`,
    `Created: ${new Date(treeNode.object.createdAt).toLocaleDateString()}`,
  ].join("\n");

  return (
    <div className={cn(styles.RelatedObjectBulletContainer)} title={tooltipContent}>
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
          {treeNode.childCount > 0 && !treeNode.isExpanded && (
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

const Controls = observer(() => {
  const { treeNode, isHovered, setUpdatingRelationType } = useTreeNode();
  return (
    <>
      <div className={styles.RelatedObjectLeftArea} />
      {/* toggle, bullet, menu */}
      <div className={styles.RelatedObjectLeftHandler}>
        <div className={styles.RelatedObjectActions}>
          <RelatedObjectMenu setUpdatingRelationType={setUpdatingRelationType} isHovered={isHovered} />
          {treeNode.childCount > 0 && (
            // (treeNode.instanceCountInPath === 1 || !settingsStore.disableCycles) &&
            <Toggle treeNode={treeNode} isHovered={isHovered} />
          )}
        </div>
      </div>
    </>
  );
});
