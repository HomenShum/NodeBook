import { ChevronDown, ChevronRight } from "lucide-react";
import { observer } from "mobx-react-lite";

import { PinCustomIcon } from "@/app/components/CustomIcons";
import { AllGroup, ChildrenGroups, PinnedGroup, PointerGroup, RootTreeNode, TreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { RelatedObjectView } from "./RelatedObjectView";
import styles from "./styles/ChildGroups.module.css";

interface ChildGroupsProps {
  treeNode: TreeNode;
}

export const ChildGroups = observer(function ChildGroups({ treeNode }: ChildGroupsProps) {
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

interface PinnedSectionProps {
  parentNode: TreeNode;
  group: PinnedGroup;
}

const PinnedSection = observer(function PinnedSection({ parentNode, group }: PinnedSectionProps) {
  const viewStore = useViewStore();
  const noteView = parentNode instanceof RootTreeNode && viewStore.viewType === ViewType.Note;
  const tree = useTree();
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
        {group.isExpanded && (
          <>
            {group.nodes.map((treeNode, i) => (
              <div key={treeNode.path}>
                {noteView && <Separator i={i} />}
                <RelatedObjectView treeNode={treeNode} showBullet={!noteView} />
              </div>
            ))}
            <div
              className={`${styles.PinSectionSeparator} ${
                viewStore.viewType === ViewType.Note ? styles.StreamSpacing : styles.DefaultSpacing
              }`}
            />
          </>
        )}
      </div>
    </>
  );
});

interface AllSectionProps {
  parentNode: TreeNode;
  group: AllGroup;
}

const AllSection = observer(function AllSection({ parentNode, group }: AllSectionProps) {
  const viewStore = useViewStore();
  const noteView = parentNode instanceof RootTreeNode && viewStore.viewType === ViewType.Note;

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

interface PointerSectionProps {
  parentNode: TreeNode;
  group: PointerGroup;
}

const PointerSection = observer(function PointerSection({ parentNode, group }: PointerSectionProps) {
  const viewStore = useViewStore();

  if (!viewStore.flattenSublists) {
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
