import { DescendantTreeNode } from "./nodes";

/**
 * Tree selection. This can either be a single node whose editor is focused or a
 * range of nodes that are selected.
 *
 * If the selection is a range of nodes, the `anchor` and `head` nodes are the
 * subtrees where the selection starts and ends. A subtree refers to a node and
 * all it's descendants. So when a node is in the selection, all it's
 * descendants are also considered selected.
 *
 * The `anchor` and `head` must not be descendants of each other. This is
 * important to contraint to make maintaining the tree across moves easier. See
 * `Tree.moveNodesIntoGroup` and
 * `Tree.updateSubtreeExpansionAndSelectionPathState` for more details.
 *
 * The entire selection must be within the same parent group. Allowing selections
 * that e.g. span the pinned and all groups is tricky to implement and can lead
 * to some unintuitive behaviours even when done right. So for now, we're keeping
 * it simple.
 */
export type TreeSelection = EditorSelection | NodeSelection;

/**
 * Tree selection with nodes resolved. See {@link TreeSelection} for more
 * details.
 */
export type TreeSelectionWithNodes =
  | (NodeSelection & {
      /** The subtree where the selection starts. */
      anchor: DescendantTreeNode;
      /** The subtree where the selection ends */
      head: DescendantTreeNode;
      /** The top-most subtree in the selection */
      top: DescendantTreeNode;
      /** The bottom-most subtree in the selection */
      bottom: DescendantTreeNode;
      /** All the nodes in the selection, including subtree descendants */
      nodes: DescendantTreeNode[];
      /** All the subtrees in the selection */
      subtreeRoots: DescendantTreeNode[];
    })
  | (EditorSelection & {
      treeNode: DescendantTreeNode;
      subtreeRoots: DescendantTreeNode[];
      top: DescendantTreeNode;
      bottom: DescendantTreeNode;
    });

export type EditorSelectionPosition = "start" | "end" | { anchorOffset: number; focusOffset: number };
export enum EditorSelectionAction {
  ClickedOnTextEditor = "clicked-on-text-editor",
  ClickedOnSuffixInput = "clicked-on-suffix-input",
  FocusingCreatedNode = "focusing-created-node",
}
export type EditorSelection = {
  type: "editor";
  treeNodeId: string;
  position?: EditorSelectionPosition;
  editMode?: boolean;
};

export type NodeSelection = {
  type: "node";
  anchorNodeId: string;
  headNodeId: string;
};
