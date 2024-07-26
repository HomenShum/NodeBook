import { Circle, Dot, GlobeIcon } from "lucide-react";
import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PinCustomIcon } from "@/app/components/CustomIcons";
import styles from "@/app/components/RelatedObject/RelatedObjectView.module.css";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useTree } from "@/app/tree/TreeContext";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { getAncestorsAsArray, isUnlabelledChild } from "@/app/tree/utils";
import { createRouteUrl, ViewType } from "@/app/view/ViewType";
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
  const graphStore = useGraphStore();
  const showRelationType = !isUnlabelledChild(treeNode) || updatingRelationType;
  const relationTypeTextWidth = showRelationType
    ? `${getTextWidth(`${treeNode.relationWithParent?.relationType.label}:`, "normal 17.5px ui-sans-serif") + 3}px`
    : "0px";
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
          ) : treeNode.object.isLocal ? (
            <RelatedObjectEditor treeNode={treeNode} />
          ) : (
            <TreeNodeReference treeNode={treeNode} />
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
  const graphStore = useGraphStore();
  const router = useRouter();
  const settingsStore = useSettingsStore();
  const { treeNode } = useTreeNode();

  const handleBulletClick = useCallback(
    (e: React.MouseEvent) => {
      const path = getAncestorsAsArray(treeNode).map((p) => p.relationToChild);
      logger.debug("Clicked bullet", treeNode.path);
      router.push(createRouteUrl(ViewType.GRAPH, ...path));
    },
    [treeNode, router],
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

function getTextWidth(text: string, font: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

/**
 * Displays the node as a non-editable reference pill. The user can place the selection
 * at the end though, so they can add a sibling below it. They can also press backspace
 * to delete the referenced node and replace it with a new one.
 */
const TreeNodeReference = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const tree = useTree();
  const graph = useGraphStore();

  // Update the input focus to match the tree selection
  useEffect(() => {
    return autorun(() => {
      if (tree.isNodeFocused(treeNode.id)) {
        inputRef.current?.focus();
      } else if (tree.selection?.type === "node" && inputRef.current?.contains(document.activeElement)) {
        inputRef.current?.blur();
      }
    });
  }, [tree, treeNode.id]);

  return (
    <div className={styles.TreeNodeReference}>
      <div onClick={() => tree.togglePathExpanded(treeNode.path)}>{treeNode.object.text}</div>
      <input
        // Update the tree selection to match the input focus
        onFocus={() => tree.setFocusedNode(treeNode.path)}
        onBlur={() => tree.isNodeFocused(treeNode.id) && tree.setFocusedNode(null)}
        onKeyDown={async (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const path = await treeNode.parent.createChild({ after: treeNode });
            tree.setFocusedNode(path);
          } else if (e.key === "Backspace") {
            e.preventDefault();
            const node = await graph.addNode({ nodeProps: { content: treeNode.object.text.slice(0, -1) } });
            await treeNode.setObject(node);
          }
        }}
        ref={inputRef}
        type="text"
        value=""
        onChange={() => {}}
      />
    </div>
  );
});
