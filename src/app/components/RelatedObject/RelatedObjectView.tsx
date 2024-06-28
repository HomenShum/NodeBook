import { Circle, Dot, GlobeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import styles from "@/app/components/RelatedObject/RelatedObjectView.module.css";
import { PinCustomIcon } from "@/app/components/icons";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { relationsToURLPath, useCurView } from "@/app/util";
import { DescendantTreeNode, getAncestorsAsArray, isUnlabelledChild } from "@/app/view/Tree";
import { useTree } from "@/app/view/TreeContext";
import { ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import { RelatedObjectChildren } from "./RelatedObjectChildren";
import { RelatedObjectViewType, TreeNodeProvider, useTreeNode } from "./RelatedObjectContext";
import { RelatedObjectDetails } from "./RelatedObjectDetails";
import { RelatedObjectEditor } from "./RelatedObjectEditor";
import { RelatedObjectMenu } from "./RelatedObjectMenu";
import { RelationCombobox } from "./RelationCombobox";
import { ReplaceRelatedNodeView } from "./ReplaceRelatedNodeView";
import Toggle from "./Toggle";

export const RelatedObjectView = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  return (
    <div id={treeNode.path} className={cn(styles.RelatedObjectContainer)}>
      <Main treeNode={treeNode}>
        <Controls />
        <Bullet />
        <Content />
      </Main>
      {treeNode.isExpanded && <RelatedObjectChildren treeNode={treeNode} />}
    </div>
  );
});

const Main = observer(({ treeNode, children }: { treeNode: DescendantTreeNode; children: React.ReactNode }) => {
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
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
        className={cn(
          styles.RelatedObjectContent,
          !treeNode.object.isPrivate &&
            settingsStore.hideThoughtstreamBullets &&
            treeNode.parent.object === graphStore.thoughtstreamRoot && // TODO: what is this for?
            styles.RelatedObjectContentPublic,
        )}
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
  const {
    treeNode,
    relationComboboxIsOpen,
    setRelationComboboxIsOpen,
    updatingRelationType,
    setUpdatingRelationType,
    viewType,
  } = useTreeNode();
  const graphStore = useGraphStore();
  const showRelationType = !isUnlabelledChild(treeNode) || updatingRelationType;
  const relationTypeTextWidth = showRelationType
    ? `${getTextWidth(`${treeNode.relationWithParent?.relationType.label}:`, "normal 17.5px ui-sans-serif") + 3}px`
    : "0px";
  return (
    <>
      <div className={styles.RelatedObjectNode}>
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
          ) : (
            <RelatedObjectEditor indentationWidth={relationTypeTextWidth} object={treeNode.object} />
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
        {!treeNode.object.isPrivate &&
          settingsStore.hideThoughtstreamBullets &&
          treeNode.parent.object === graphStore.thoughtstreamRoot && ( // TODO: what is this for?
            <div className={styles.RelatedObjectPublic}>
              <GlobeIcon size={12} strokeWidth={2} />
            </div>
          )}
        {treeNode.object.relations.length > 1 && (
          <div className={styles.RelationCounter}>{treeNode.object.relations.length - 1}</div>
        )}
      </div>
    </>
  );
});

const Bullet = observer(() => {
  const tree = useTree();
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const curView = useCurView();
  const router = useRouter();
  const settingsStore = useSettingsStore();
  const { treeNode } = useTreeNode();

  const handleBulletClick = useCallback(
    (e: React.MouseEvent) => {
      const path = getAncestorsAsArray(treeNode).map((p) => p.relationToChild);
      if (e.shiftKey) {
        logger.debug("Shift-clicked bullet", treeNode.path);
        viewStore.openSidebarOutlineView(path);
      } else {
        logger.debug("Clicked bullet", treeNode.path);
        switch (curView) {
          case ViewType.OUTLINE:
            router.push(`/outline${relationsToURLPath(path, graphStore)}`);
            break;
          case ViewType.THOUGHTSTREAM:
            router.push(`/stream${relationsToURLPath(path, graphStore)}`);
            break;
          case ViewType.SPLIT:
            tree.setRoot(path);
            break;
          default:
            curView satisfies never;
        }
      }
    },
    [tree, treeNode, curView, router, graphStore, viewStore],
  );

  return (
    <div
      className={cn(
        styles.RelatedObjectBulletContainer,
        settingsStore.hideThoughtstreamBullets &&
          treeNode.parent.object === graphStore.thoughtstreamRoot &&
          styles.Hidden,
      )}
    >
      {treeNode.instanceCountInPath <= 1 ? (
        // Default solid bullet
        <>
          <Dot
            strokeWidth={5}
            height={16}
            className={cn(styles.Bullet, {
              [styles.DotInsidePublic]: !treeNode.object.isPrivate,
              [styles.DotInsidePrivate]: treeNode.object.isPrivate,
            })}
            onClick={handleBulletClick}
          />
          {treeNode.childCount > 0 && !treeNode.isExpanded && (
            // with a shadow around it if it has children
            <Dot
              height={16}
              strokeWidth={17}
              className={cn(styles.BulletShadow, {
                [styles.DotOutsidePublic]: !treeNode.object.isPrivate,
                [styles.DotOutsidePrivate]: treeNode.object.isPrivate,
              })}
            />
          )}
        </>
      ) : (
        // Hollow circle if this node has appeared in the path more than once
        <Circle
          strokeWidth={6}
          height={8}
          className={cn(styles.Circle, { [styles.CirclePrivate]: treeNode.object.isPrivate })}
          onClick={handleBulletClick}
        />
      )}
    </div>
  );
});

const Controls = observer(() => {
  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();
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

const canvas = document.createElement("canvas");
function getTextWidth(text: string, font: string) {
  const context = canvas.getContext("2d")!;
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}
