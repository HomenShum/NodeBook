import { Circle, Dot } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { PinCustomIcon } from "@/app/components/CustomIcons";
import { RelatedRelationView } from "@/app/components/RelatedObject/RelatedRelationView";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/UIPrimitives/Tooltip";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useTree } from "@/app/tree/TreeContext";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { isUnlabelledChild } from "@/app/tree/utils";
import { createRouteUrl } from "@/app/util";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import { RelatedNodeView } from "./RelatedNodeView";
import { RelatedObjectChildren } from "./RelatedObjectChildren";
import { RelatedObjectViewType, TreeNodeProvider, useTreeNode } from "./RelatedObjectContext";
import { RelatedObjectDetails } from "./RelatedObjectDetails";
import { RelatedObjectMenu } from "./RelatedObjectMenu";
import { RelationCombobox } from "./RelationCombobox";
import { ReplaceRelatedNodeView } from "./ReplaceRelatedNodeView";
import Toggle from "./Toggle";

import styles from "./RelatedObjectView.module.css";

export const RelatedObjectView = observer(
  ({ treeNode, showBullet = true }: { treeNode: DescendantTreeNode; showBullet?: boolean }) => {
    return (
      <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)}>
        <Main treeNode={treeNode}>
          <Controls />
          {showBullet && <Bullet />}
          <Content />
        </Main>
        {treeNode.isExpanded && <RelatedObjectChildren treeNode={treeNode} />}
      </div>
    );
  },
);

export const ClickToCreateNode = observer(({ treeNode }: { treeNode: RootTreeNode }) => {
  const tree = useTree();
  const handleCreateAndFocusNode = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      tree.createChildOfRootAndFocus();
    },
    [tree],
  );

  if (treeNode.childCount !== 0) return null;

  return (
    <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)} onClick={handleCreateAndFocusNode}>
      <div className={styles.RelatedObjectContent}>
        <div className={cn(styles.RelatedObjectBulletContainer)}>
          <Dot strokeWidth={5} height={16} className={cn(styles.Bullet, styles.DotInsideClickToCreateNode)} />
        </div>
        <div className={cn(styles.RelatedObjectNode)}>
          <div className={styles.ClickToCreateNode}>Click to create</div>
        </div>
      </div>
    </div>
  );
});

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={styles.RelationCounter}>{treeNode.object.relations.length - 1}</div>
              </TooltipTrigger>
              <TooltipContent side="left" align="center" sideOffset={5}>
                Direct relations
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </>
  );
});

const Bullet = observer(() => {
  const userId = useGraphStore().user?.id;
  const router = useRouter();
  const { treeNode } = useTreeNode();

  const handleBulletClick = useCallback(() => {
    logger.debug("Clicked bullet", treeNode.path);
    router.push(createRouteUrl(`${treeNode.path}/${treeNode.object.id}`));
  }, [treeNode, router]);

  const tooltipContent = (
    <>
      <div className={styles.TooltipContent}>
        Object author: {treeNode.object.authorId === userId ? "You" : treeNode.object.authorId}
      </div>
      <div className={styles.TooltipContent}>
        Relation author:{" "}
        {treeNode.relationWithParent.authorId === userId ? "You" : treeNode.relationWithParent.authorId}
      </div>
      <div className={styles.TooltipContent}>Created: {new Date(treeNode.object.createdAt).toLocaleDateString()}</div>
    </>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(styles.RelatedObjectBulletContainer)}>
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
        </TooltipTrigger>
        <TooltipContent side="top" align="start" sideOffset={5}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
