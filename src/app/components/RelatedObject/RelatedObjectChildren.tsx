import { ChevronDown, ChevronRight } from "lucide-react";
import { observer } from "mobx-react-lite";

import { PinCustom } from "@/app/components/icons";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { formatDate } from "@/app/util";
import { TreeNode, useTree } from "@/app/view/Tree";

import { RelatedObjectView } from "./RelatedObjectView";

import styles from "./RelatedObjectChildren.module.css";

export const RelatedObjectChildren = observer(({ treeNode }: { treeNode: TreeNode }) => {
  return (
    <div className={treeNode.depth > 0 ? styles.NodeIndentation : ""}>
      {treeNode.pinnedChildCount > 0 && <PinnedSection treeNode={treeNode} />}
      <AllSection treeNode={treeNode} />
    </div>
  );
});

const PinnedSection = observer(({ treeNode }: { treeNode: TreeNode }) => {
  const tree = useTree();
  const graphStore = useGraphStore();
  return (
    <>
      <button
        onClick={() => tree.togglePinnedPathExpanded(treeNode.path)}
        className={`${styles.PinnedToggleButton}  ${
          treeNode.isPinnedExpanded ? styles.PinnedToggleButton_PinnedVisible : styles.PinnedToggleButton_PinnedHidden
        }`}
      >
        <span
          className={`${styles.PinIcon} ${
            treeNode.isPinnedExpanded ? styles.PinIcon_PinnedVisible : styles.PinIcon_PinnedHidden
          }`}
        >
          <PinCustom />
        </span>
        {treeNode.isPinnedExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {treeNode.isPinnedExpanded && (
        <div className={styles.PinSection}>
          {treeNode.isPinnedExpanded &&
            treeNode.pinnedChildren.map((treeNode, i) => {
              return (
                <div key={treeNode.path}>
                  <RelatedObjectView treeNode={treeNode} />
                </div>
              );
            })}
          <div
            className={`${styles.PinSectionSeparator} ${
              treeNode.parent?.object === graphStore.thoughtstreamRoot ? styles.StreamSpacing : styles.DefaultSpacing
            }`}
          />
        </div>
      )}
    </>
  );
});

const AllSection = observer(({ treeNode }: { treeNode: TreeNode }) => {
  const bundles =
    treeNode.type === "descendant" && treeNode.parent.type === "descendant" // TODO: ugly
      ? treeNode.parent.children
          .filter(({ object }) => object instanceof GraphNode && object.isBundle)
          .map(({ object }) => object)
      : [];
  const findRelationsFirstBundle = (r: GraphRelation) =>
    bundles.find((b) => b.children.map((o) => o.id).includes(r.id));
  let currentDate: string | undefined;
  let lastBundleId: string | undefined;
  let lastDisplayedDate: string | undefined;
  return (
    <div>
      {treeNode.children.map((childTreeNode, i) => {
        const childRelation = childTreeNode.relationWithParent;
        const firstBundle = findRelationsFirstBundle(childRelation);
        const newBundle = firstBundle?.id !== lastBundleId;
        lastBundleId = firstBundle?.id;
        currentDate = newBundle && currentDate !== lastDisplayedDate ? formatDate(firstBundle?.createdAt) : undefined;
        lastDisplayedDate = lastDisplayedDate || currentDate;
        return (
          <div key={childTreeNode.path}>
            {newBundle && <BundleSeparator i={i} currentDate={currentDate} />}
            <RelatedObjectView treeNode={childTreeNode} />
          </div>
        );
      })}
    </div>
  );
});

function BundleSeparator({ i, currentDate }: { i: number; currentDate?: string }) {
  return (
    <>
      <div
        className={`${styles.BundleSeparator} ${
          i === 0
            ? `${styles.FirstBundle} ${currentDate ? styles.FirstBundle_WithDate : styles.FirstBundle_NoDate}`
            : styles.DefaultBundle
        }`}
      />
      {currentDate && (
        <div className={styles.DateLabel}>
          <span className={styles.DateLabelContent}>{currentDate}</span>
        </div>
      )}
    </>
  );
}
