import { observer } from "mobx-react-lite";

import { AddPinButton } from "@/app/components/Buttons/AddPinButton";
import { CreateNewButton } from "@/app/components/Buttons/CreateNewButton";
import { PinCustomIcon } from "@/app/components/CustomIcons";
import { formatNoteSeparatorDate } from "@/app/components/RelatedObject/utils/helpers";
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
import { useIsMobile } from "@/app/util";
import { ViewType } from "@/app/view/types";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { RelatedObjectView } from "./RelatedObjectView";
import styles from "./styles/ChildGroups.module.css";
import { usePagination } from "./utils/usePagination";

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
      {group.nodes
        .filter((node) => node.object.objectType !== "placeholder")
        .map((treeNode, i) => {
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
  const isSmallScreen = useIsMobile(600);
  const isRoot = parentNode instanceof RootTreeNode;
  const isEmpty = group.nodes.length === 0;
  const viewType =
    parentNode.tree instanceof QuickCaptureTree || parentNode.tree instanceof QuickCaptureSearchTree
      ? viewStore.quickCaptureViewType
      : viewStore.viewType;
  const noteView = parentNode instanceof RootTreeNode && viewType === ViewType.Note;
  const allowAnonymousAppend =
    parentNode.object instanceof GraphNode && parentNode.object.accessMode === AccessMode.APPEND;

  if (isEmpty && !group.isExpanded && !isRoot) {
    return null;
  }

  return (
    <>
      <div className={cn(styles.TopHeader, isRoot && styles.TopHeaderRoot)}>
        {isRoot && (!user.isAnonymous || allowAnonymousAppend) && !isSmallScreen && <CreateNewButton tree={tree} />}
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
          {group.nodes
            .filter((node) => node.object.objectType !== "placeholder")
            .map((treeNode, i) => {
              const showDate =
                i == 0 ||
                treeNode.object.createdAt.toDateString() !== group.nodes[i - 1].object.createdAt.toDateString();
              return (
                <div key={treeNode.path}>
                  {noteView && <Separator i={i} date={showDate ? treeNode.object.createdAt : null} />}
                  <RelatedObjectView treeNode={treeNode} />
                </div>
              );
            })}
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
  const settingsStore = useSettingsStore();
  const viewStore = useViewStore();
  const viewType =
    parentNode.tree instanceof QuickCaptureTree || parentNode.tree instanceof QuickCaptureSearchTree
      ? viewStore.quickCaptureViewType
      : viewStore.viewType;
  const noteView = parentNode instanceof RootTreeNode && viewType === ViewType.Note;
  const { paginatedNodes, loadNext, loadPrevious } = usePagination(group.nodes);

  return (
    <div>
      {loadPrevious && (
        <div style={{ marginTop: "20px" }}>
          <Button onClick={() => loadPrevious()}>Load more</Button>
        </div>
      )}
      {paginatedNodes
        .filter((childTreeNode) => {
          return (
            childTreeNode.object.objectType !== "placeholder" &&
            (!settingsStore.hidePinnedItems ||
              !childTreeNode.parent.object.isRelationPinned(childTreeNode.relationWithParent)) &&
            !(
              !settingsStore.showHiddenRelations &&
              hiddenRelationTypeIds.has(childTreeNode.relationWithParent.relationTypeId)
            )
          );
        })
        .reduce((acc, childTreeNode, i, array) => {
          const prevNode = i > 0 ? array[i - 1] : null;
          const showDate =
            noteView &&
            (!prevNode || childTreeNode.object.createdAt.toDateString() !== prevNode.object.createdAt.toDateString());
          acc.push(
            <div key={childTreeNode.path}>
              {noteView && <Separator i={i} date={showDate ? childTreeNode.object.createdAt : null} />}
              <RelatedObjectView treeNode={childTreeNode} />
            </div>,
          );
          return acc;
        }, [] as JSX.Element[])}
      {loadNext && (
        <div style={{ margin: "20px 0px" }}>
          <Button onClick={() => loadNext()}>Load more</Button>
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
      {group.nodes
        .filter((node) => node.object.objectType !== "placeholder")
        .map((childTreeNode, i) => {
          return (
            <div key={childTreeNode.path}>
              <RelatedObjectView treeNode={childTreeNode} />
            </div>
          );
        })}
    </div>
  );
});

function Separator({ i, date }: { i: number; date: Date | null }) {
  if (!date) {
    return <div className={cn(styles.NoteSeparator, i === 0 ? styles.FirstNote : styles.DefaultNote)} />;
  } else {
    return (
      <div className={cn(styles.NoteSeparatorWithDate, i === 0 ? styles.FirstNote : styles.DefaultNote)}>
        {formatNoteSeparatorDate(date)}
      </div>
    );
  }
}
