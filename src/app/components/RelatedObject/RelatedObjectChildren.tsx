import { ChevronDown, ChevronRight } from "lucide-react";
import { observer } from "mobx-react-lite";

import { PinCustomIcon } from "@/app/components/CustomIcons";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useTree } from "@/app/tree/TreeContext";
import { ViewType } from "@/app/view/types";
import { AllGroup, ChildrenGroups, PinnedGroup, PointerGroup, RootTreeNode, TreeNode } from "@/app/tree/nodes";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { RelatedObjectView } from "./RelatedObjectView";

import styles from "./RelatedObjectChildren.module.css";

export const RelatedObjectChildren = observer(({ treeNode }: { treeNode: TreeNode }) => {
  const children: ChildrenGroups = treeNode.childrenGroups;
  const isRoot = treeNode instanceof RootTreeNode;
  return (
    <div className={cn(!isRoot && styles.NodeIndentation)}>
      {children.map((group) => {
        if (group instanceof PointerGroup) {
          return <PointerSection key={group.path} parentNode={treeNode} group={group} />;
        } else if (group instanceof PinnedGroup) {
          return <PinnedSection key={group.path} parentNode={treeNode} group={group} />;
        } else {
          return <AllSection key={group.path} parentNode={treeNode} group={group} />;
        }
      })}
    </div>
  );
});

const PinnedSection = observer(({ parentNode, group }: { parentNode: TreeNode; group: PinnedGroup }) => {
  const viewStore = useViewStore();
  const noteView = parentNode instanceof RootTreeNode && viewStore.viewType === ViewType.Note;
  const tree = useTree();
  const graphStore = useGraphStore();
  if (group.nodes.length === 0) {
    return null;
  }
  return (
    <>
      <button
        onClick={() => tree.toggleGroupExpanded(group.path)}
        className={`${styles.PinnedToggleButton}  ${tree.isGroupExpanded(group.id)
          ? styles.PinnedToggleButton_PinnedVisible
          : styles.PinnedToggleButton_PinnedHidden
          }`}
      >
        <span
          className={`${styles.PinIcon} ${group.isExpanded ? styles.PinIcon_PinnedVisible : styles.PinIcon_PinnedHidden
            }`}
        >
          <PinCustomIcon />
        </span>
        {group.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <div className={styles.PinSection}>
        {group.isExpanded && (
          <>
            {group.nodes.map((treeNode, i) => (
              <div key={treeNode.path}>
                {noteView && <Separator i={i} />}
                <RelatedObjectView treeNode={treeNode} showBullet={!noteView} />
              </div>
            ))}
            <div
              className={`${styles.PinSectionSeparator} ${viewStore.viewType === ViewType.Note ? styles.StreamSpacing : styles.DefaultSpacing
                }`}
            />
          </>
        )}
      </div>
    </>
  );
});

const AllSection = observer(({ parentNode, group }: { parentNode: TreeNode; group: AllGroup }) => {
  const viewStore = useViewStore();
  const noteView = parentNode instanceof RootTreeNode && viewStore.viewType === "note";
  const sublistView = parentNode instanceof RootTreeNode && viewStore.viewType === "sublist";

  if (sublistView) {
    return null;
  }
  return (
    <div>
      {group.nodes.map((childTreeNode, i) => {
        return (
          <div key={childTreeNode.path}>
            {noteView && <Separator i={i} />}
            <RelatedObjectView treeNode={childTreeNode} showBullet={!noteView} />
          </div>
        );
      })}
    </div>
  );
});

const PointerSection = observer(({ parentNode, group }: { parentNode: TreeNode; group: PointerGroup }) => {
  const viewStore = useViewStore();
  const sublistView = parentNode instanceof RootTreeNode && viewStore.viewType === "sublist";

  if (!sublistView) {
    return null;
  }

  return (
    <div>
      {group.nodes.map((childTreeNode, i) => {
        return (
          <div key={childTreeNode.path}>
            <RelatedObjectView treeNode={childTreeNode} showBullet={true} />
          </div>
        );
      })}
    </div>
  );
});

function Separator({ i }: { i: number }) {
  return <div className={cn(styles.BundleSeparator, i === 0 ? styles.FirstBundle : styles.DefaultBundle)} />;
}
