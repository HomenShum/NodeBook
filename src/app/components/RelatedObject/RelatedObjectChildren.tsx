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

export const RelatedObjectChildren = observer(
  ({
    treeNode,
  }: // showAll = true,
  // setShowAll,
  {
    treeNode: TreeNode;
    // showAll?: boolean;
    // setShowAll?: Dispatch<SetStateAction<boolean>>;
  }) => {
    const tree = useTree();
    const graphStore = useGraphStore();

    const bundles =
      treeNode.type === "descendant" && treeNode.parent.type === "descendant" // TODO: ugly
        ? treeNode.parent.children
            .filter(({ object }) => object instanceof GraphNode && object.isBundle)
            .map(({ object }) => object)
        : [];
    const findRelationsFirstBundle = (r: GraphRelation) =>
      bundles.find((b) => b.children.map((o) => o.id).includes(r.id));

    let lastBundleId: string | undefined;
    let lastDisplayedDate: string | undefined;

    return (
      <div className={treeNode.depth > 0 ? styles.NodeIndentation : ""}>
        {treeNode.pinnedChildCount > 0 && (
          <>
            <button
              onClick={() => tree.togglePinnedPathExpanded(treeNode.path)}
              className={`${styles.PinnedToggleButton}  ${
                treeNode.isPinnedExpanded
                  ? styles.PinnedToggleButton_PinnedVisible
                  : styles.PinnedToggleButton_PinnedHidden
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
                    treeNode.parent?.object === graphStore.thoughtstreamRoot
                      ? styles.StreamSpacing
                      : styles.DefaultSpacing
                  }`}
                />
              </div>
            )}
          </>
        )}
        {treeNode.children.map((childTreeNode, i) => {
          const childRelation = childTreeNode.relationWithParent;
          const firstBundle = findRelationsFirstBundle(childRelation);
          const newBundle = firstBundle?.id !== lastBundleId;
          const currentDate = formatDate(firstBundle?.createdAt);
          const displayDate = newBundle && currentDate !== lastDisplayedDate;
          lastBundleId = firstBundle?.id;
          if (displayDate) {
            lastDisplayedDate = currentDate;
          }
          return (
            <div key={childTreeNode.path}>
              {newBundle && (
                <>
                  <div
                    className={`${styles.BundleSeparator} ${
                      i === 0
                        ? `${styles.FirstBundle} ${
                            displayDate ? styles.FirstBundle_WithDate : styles.FirstBundle_NoDate
                          }`
                        : styles.DefaultBundle
                    }`}
                  />
                  {displayDate && (
                    <div className={styles.DateLabel}>
                      <span className={styles.DateLabelContent}>{currentDate}</span>
                    </div>
                  )}
                </>
              )}
              <RelatedObjectView treeNode={childTreeNode} />
            </div>
          );
        })}
      </div>
    );
  },
);
