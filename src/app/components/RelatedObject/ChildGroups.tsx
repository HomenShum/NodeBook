import { observer } from "mobx-react-lite";
import { useState } from "react";

import { AddPinButton } from "@/app/components/Buttons/AddPinButton";
import { CreateNewButton } from "@/app/components/Buttons/CreateNewButton";
import { PinCustomIcon } from "@/app/components/CustomIcons";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { hiddenRelationTypeIds } from "@/app/graph/constants";
import { AccessMode, GraphNode } from "@/app/graph/GraphNode";
import {
  AllGroup,
  ChildrenGroups,
  DescendantTreeNode,
  NoteContentGroup,
  PinnedGroup,
  PointerGroup,
  RootTreeNode,
  TreeNode,
} from "@/app/tree/nodes";
import { QuickCaptureSearchTree, QuickCaptureTree } from "@/app/tree/QuickCaptureTree";
import { SearchTree } from "@/app/tree/SearchTree";
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

  if (children.filter((group) => group.nodes.length > 0).length === 0) {
    return null;
    // <div className={styles.NodeIndentation}>
    //   <ClickToCreateChildrenButton treeNode={treeNode} />
    // </div>
  }

  return (
    <div className={cn(!isRoot && styles.NodeIndentation)}>
      {children.map((group) => {
        if (group instanceof PointerGroup) {
          return <PointerSection key={group.path} parentNode={treeNode} group={group} />;
        } else if (group instanceof PinnedGroup) {
          return <PinnedSection key={group.path} parentNode={treeNode} group={group} />;
        } else if (group instanceof AllGroup) {
          return <AllSection key={group.path} parentNode={treeNode} group={group} />;
        }
      })}
    </div>
  );
});

interface NoteContentSectionProps {
  parentNode: TreeNode;
  group: NoteContentGroup;
}

export const NoteContentSection = observer(function NoteContentSection({ parentNode, group }: NoteContentSectionProps) {
  const viewStore = useViewStore();
  const viewType =
    parentNode.tree instanceof QuickCaptureTree || parentNode.tree instanceof QuickCaptureSearchTree
      ? viewStore.quickCaptureViewType
      : viewStore.viewType;
  if (parentNode instanceof DescendantTreeNode && parentNode.instanceCountInPath > 1) {
    return <div>Circular reference to {`"${parentNode.object.text}"`}</div>;
  }
  if (group.nodes.length === 0) {
    return null;
  }
  const topLevelNote = viewType === "note" && parentNode.parent instanceof RootTreeNode;
  const rootNote = parentNode instanceof RootTreeNode;
  return (
    <div>
      {group.nodes.map((treeNode, i) => {
        return (
          <div
            key={treeNode.path}
            style={{
              marginLeft: topLevelNote || rootNote ? "0px" : "-20px",
              paddingBottom:
                i === group.nodes.length - 1 &&
                treeNode.childrenGroupsById.all.nodes[0]?.childrenGroupsById.noteContent?.nodes.length > 0
                  ? "20px"
                  : "1px",
            }}
          >
            <RelatedObjectView treeNode={treeNode} />
          </div>
        );
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
  const tree = parentNode.tree;
  const user = useUser();
  const isRoot = parentNode instanceof RootTreeNode;
  const isEmpty = group.nodes.length === 0;
  const viewType =
    parentNode.tree instanceof QuickCaptureTree || parentNode.tree instanceof QuickCaptureSearchTree
      ? viewStore.quickCaptureViewType
      : viewStore.viewType;
  const noteView = parentNode instanceof RootTreeNode && viewType === ViewType.Note;
  const allowAnonymousAppend =
    parentNode.object instanceof GraphNode && parentNode.object.accessMode === AccessMode.APPEND;

  if (tree instanceof SearchTree || (isEmpty && !group.isExpanded && !isRoot)) {
    return null;
  }

  return (
    <>
      <div className={cn(styles.TopHeader, isRoot && styles.TopHeaderRoot)}>
        {isRoot && (!user.isAnonymous || allowAnonymousAppend) && <CreateNewButton tree={tree} />}
      </div>
      {!isEmpty && (
        <div className={styles.PinnedHeader}>
          <Button
            variant={group.isExpanded ? "ghostActive" : "ghostSmooth"}
            size="xs"
            onClick={() => tree.toggleGroupExpanded(group.path)}
          >
            <span className={`${styles.PinIcon} ${group.isExpanded && styles.PinIcon_PinnedVisible}`}>
              <PinCustomIcon />
            </span>
            Pinned
            <span className={styles.PinnedCount}>{group.nodes.length}</span>
          </Button>
          {!user.isAnonymous && <AddPinButton parentNode={parentNode} group={group} />}
        </div>
      )}

      {group.isExpanded && !isEmpty && (
        <>
          {group.nodes.map((treeNode, i) => (
            <div key={treeNode.path}>
              {noteView && <Separator i={i} />}
              <RelatedObjectView treeNode={treeNode} />
            </div>
          ))}
          <div
            className={`${styles.PinSectionSeparator} ${
              viewType === ViewType.Note ? styles.StreamSpacing : styles.DefaultSpacing
            }`}
          />
        </>
      )}
    </>
  );
});

interface AllSectionProps {
  parentNode: TreeNode;
  group: AllGroup;
}

const AllSection = observer(function AllSection({ parentNode, group }: AllSectionProps) {
  const [limit, setLimit] = useState(50);
  const settingsStore = useSettingsStore();
  const viewStore = useViewStore();
  const viewType =
    parentNode.tree instanceof QuickCaptureTree || parentNode.tree instanceof QuickCaptureSearchTree
      ? viewStore.quickCaptureViewType
      : viewStore.viewType;
  const noteView = parentNode instanceof RootTreeNode && viewType === ViewType.Note;

  return (
    <div>
      {group.nodes
        .slice(0, limit)
        .filter((childTreeNode) => {
          if (
            !settingsStore.showHiddenRelations &&
            childTreeNode.relationWithParent.relationTypeId in hiddenRelationTypeIds
          ) {
            console.log("Hiding relation id: ", childTreeNode.relationWithParent.id);
          }
          return (
            (!settingsStore.hidePinnedItems ||
              !childTreeNode.parent.object.isRelationPinned(childTreeNode.relationWithParent)) &&
            !(
              !settingsStore.showHiddenRelations &&
              hiddenRelationTypeIds.has(childTreeNode.relationWithParent.relationTypeId)
            )
          );
        })
        .map((childTreeNode, i) => {
          return (
            <div key={childTreeNode.path}>
              {noteView && <Separator i={i} />}
              <RelatedObjectView treeNode={childTreeNode} />
            </div>
          );
        })}
      {limit < group.nodes.length && (
        <div style={{ marginTop: "20px" }}>
          <Button onClick={() => setLimit(limit + 30)}>Load more</Button>
        </div>
      )}
    </div>
  );
});

interface PointerSectionProps {
  parentNode: TreeNode;
  group: PointerGroup;
}

const PointerSection = observer(function PointerSection({ group }: PointerSectionProps) {
  const viewStore = useViewStore();

  if (!viewStore.flattenSublists) {
    return null;
  }

  return (
    <div>
      {group.nodes.map((childTreeNode, i) => {
        return (
          <div key={childTreeNode.path}>
            <RelatedObjectView treeNode={childTreeNode} />
          </div>
        );
      })}
    </div>
  );
});

function Separator({ i }: { i: number }) {
  return <div className={cn(styles.NoteSeparator, i === 0 ? styles.FirstNote : styles.DefaultNote)} />;
}
