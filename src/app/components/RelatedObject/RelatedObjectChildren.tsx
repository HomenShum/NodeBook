import { ChevronDown, ChevronRight } from "lucide-react";
import { observer } from "mobx-react-lite";

import { PinCustomIcon } from "@/app/components/icons";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useTree } from "@/app/tree/TreeContext";
import { AllGroup, DescendantTreeNode, PinnedGroup, RootTreeNode, TreeNode } from "@/app/tree/nodes";
import { formatDate } from "@/app/util";
import { cn } from "@/lib/utils";

import { RelatedObjectView } from "./RelatedObjectView";

import styles from "./RelatedObjectChildren.module.css";

export const RelatedObjectChildren = observer(({ treeNode }: { treeNode: TreeNode }) => {
  const children = treeNode.childrenGroups;
  const isRoot = treeNode instanceof RootTreeNode;
  return (
    <div className={cn(!isRoot && styles.NodeIndentation)}>
      {children.map((group) => {
        switch (group.id) {
          case "pinned":
            return <PinnedSection key={group.id} parentNode={treeNode} group={group} />;
          case "all":
            return <AllSection key={group.id} parentNode={treeNode} group={group} />;
          default:
            return group satisfies never;
        }
      })}
    </div>
  );
});

const PinnedSection = observer(({ parentNode, group }: { parentNode: TreeNode; group: PinnedGroup }) => {
  const tree = useTree();
  const graphStore = useGraphStore();
  if (group.nodes.length === 0) {
    return null;
  }
  return (
    <>
      <button
        onClick={() => tree.toggleGroupExpanded(group.path)}
        className={`${styles.PinnedToggleButton}  ${
          tree.isGroupExpanded(group.id)
            ? styles.PinnedToggleButton_PinnedVisible
            : styles.PinnedToggleButton_PinnedHidden
        }`}
      >
        <span
          className={`${styles.PinIcon} ${
            group.isExpanded ? styles.PinIcon_PinnedVisible : styles.PinIcon_PinnedHidden
          }`}
        >
          <PinCustomIcon />
        </span>
        {group.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <div className={styles.PinSection}>
        {/* TODO I don't like that this react component needs to thing about whether
        the group is expanded or not. would be nice if there was a prop of nodes that
        was either empty or not depending on expansion so component can be dumber  */}
        {group.isExpanded && (
          <>
            {group.nodes.map((treeNode) => (
              <div key={treeNode.path}>
                <RelatedObjectView treeNode={treeNode} />
              </div>
            ))}
            <div
              className={`${styles.PinSectionSeparator} ${
                parentNode.parent?.object === graphStore.thoughtstreamRoot
                  ? styles.StreamSpacing
                  : styles.DefaultSpacing
              }`}
            />
          </>
        )}
      </div>
    </>
  );
});

const AllSection = observer(({ parentNode, group }: { parentNode: TreeNode; group: AllGroup }) => {
  const bundles =
    parentNode instanceof DescendantTreeNode && parentNode.parent instanceof DescendantTreeNode // TODO: ugly
      ? parentNode.parent.object.children.filter((object) => object instanceof GraphNode && object.isBundle)
      : [];
  const findRelationsFirstBundle = (r: GraphRelation) =>
    bundles.find((b) => b.children.map((o) => o.id).includes(r.id));
  let currentDate: string | undefined;
  let lastBundleId: string | undefined;
  let lastDisplayedDate: string | undefined;
  return (
    <div>
      {group.nodes.map((childTreeNode, i) => {
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
