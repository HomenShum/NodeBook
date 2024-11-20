import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { createRouteUrl, ObjectPath } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";

import { DescendantTreeNode, GroupId, PathToRootNode, RootTreeNode, TreeNode } from "./nodes";

export type Ancestor = {
  object: GraphObject;
  relationToChild: GraphRelation;
  path: string;
};

/**
 * Get all ancestors of a tree node as an array.
 *
 * Order is from *furthest* to *closest* ancestor.
 *
 * Includes the nodes leading to the root, the root itself, and all
 * the nodes leading to the given one.
 */
export const getAncestorsAsArray = (node: TreeNode): Ancestor[] => {
  const ancestors: Ancestor[] = [];
  // Get up to the root and including the root
  let treeNode = node;
  while (!(treeNode instanceof RootTreeNode)) {
    ancestors.push({
      object: treeNode.parent.object,
      relationToChild: treeNode.relationWithParent,
      path: treeNode.parent.path,
    });
    treeNode = treeNode.parent;
  }
  // Get path nodes above the root
  let pathNode: PathToRootNode | null = treeNode.parent;
  while (pathNode) {
    ancestors.push({ object: pathNode.object, relationToChild: pathNode.relationToChild, path: pathNode.path });
    pathNode = pathNode.parent;
  }
  // Reverse the array so it goes from furthest to closest
  return ancestors.reverse();
};

export const treeNodeToObjectPath = (node: TreeNode): ObjectPath => {
  return { object: node.object, relations: getAncestorsAsArray(node).map((node) => node.relationToChild) };
};

export const isUnlabelledChild = (node: DescendantTreeNode) => {
  return node.relationWithParent.relationType.id === "child" && node.relationWithParent.to === node.object;
};

function getLastDescendant(treeNode: DescendantTreeNode): DescendantTreeNode {
  let current = treeNode;
  let next = current;
  while (next) {
    current = next;
    const children = current.visibleChildren;
    next = children[children.length - 1];
  }
  return current;
}

/**
 * When the tree is rendered as an outline, this function returns the node
 * rendered directly above the given node.
 */
export function getNextAbove(treeNode: TreeNode): DescendantTreeNode | undefined {
  if (treeNode instanceof RootTreeNode) {
    return;
  }
  if (treeNode.siblingAbove) {
    return getLastDescendant(treeNode.siblingAbove);
  } else if (treeNode.parent instanceof DescendantTreeNode) {
    if (isNoteContent(treeNode)) {
      // At top of a note. While a node has note content, we render that in place
      // of the GraphNode.content prop. So in this case treeNode.parent isn't rendered,
      // so we step up to the next above that.
      return getNextAbove(treeNode.parent);
    } else {
      return treeNode.parent;
    }
  }
}

/**
 * When the tree is rendered as an outline, this function returns the node
 * rendered directly below the given node.
 */
export function getNextBelow(treeNode: TreeNode): DescendantTreeNode | undefined {
  const firstChild = treeNode.visibleChildren[0];
  if (firstChild) {
    return firstChild;
  } else if (treeNode instanceof RootTreeNode) {
    return;
  } else {
    if (treeNode.siblingBelow) {
      return treeNode.siblingBelow;
    } else {
      // get sibling below of nearest ancestor
      let current = treeNode;
      while (current.parent instanceof DescendantTreeNode) {
        if (current.parent.siblingBelow) {
          return current.parent.siblingBelow;
        }
        current = current.parent;
      }
      return;
    }
  }
}

export function createDescendantTreeNodesById(root: TreeNode) {
  const nodesById = new Map<string, DescendantTreeNode>();
  const stack: TreeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node instanceof DescendantTreeNode) {
      nodesById.set(node.path, node);
    }
    node.childrenGroups.forEach((group) => {
      group.nodes.forEach((child) => stack.push(child));
    });
  }
  return nodesById;
}

export function groupSiblings(treeNodes: DescendantTreeNode[]): DescendantTreeNode[][] {
  const siblingGroups = new Map<string, DescendantTreeNode[]>();
  treeNodes.forEach((node) => {
    const group = siblingGroups.get(node.parentGroup.path);
    if (group) {
      group.push(node);
    } else {
      siblingGroups.set(node.parentGroup.path, [node]);
    }
  });
  return Array.from(siblingGroups.values());
}

/**
 * Get the next subtree below. Like {@link getNextBelow} but it skips
 * the given nodes descendants..
 */
export function getNextSubtreeBelow(treeNode: DescendantTreeNode): DescendantTreeNode | null {
  let next = getNextBelow(treeNode);
  while (next && next.isDescendantOf(treeNode)) {
    next = getNextBelow(next);
  }
  return next || null;
}

/**
 * Walks the tree from top to bottom, returning the nodes in order
 * excluding their descendants.
 */

export function getSubtreesBetween(top: DescendantTreeNode, bottom: DescendantTreeNode) {
  if (top.parentGroup.id !== bottom.parentGroup.id) return [];

  const subtrees: DescendantTreeNode[] = [];
  if (top.isAncestorOf(bottom)) {
    return [top];
  }

  let current: DescendantTreeNode | null = top;
  while (current && current !== bottom) {
    subtrees.push(current);
    if (current.isAncestorOf(bottom)) {
      return subtrees;
    }
    current = current.siblingBelowInSameGroup || getNextSubtreeBelow(current);
  }
  subtrees.push(bottom);
  return subtrees;
}

/**
 * Executes a callback on each node in the tree, starting with the given node.
 * If the callback returns false, the walk won't descend that node.
 */
export function walkTree(treeNode: TreeNode, callback: (node: TreeNode) => boolean | void) {
  const res = callback(treeNode);
  if (res === false) return;
  treeNode.visibleChildren.forEach((child) => walkTree(child, callback));
}

export function useSetRoot() {
  const viewStore = useViewStore();
  const router = useRouter();
  return useCallback(
    (objectPath: ObjectPath) => {
      const path = createRouteUrl(objectPath);
      viewStore.setRoot(objectPath, path);
      router.push(path);
    },
    [viewStore, router],
  );
}

export const isNoteContent = (treeNode: TreeNode) =>
  treeNode instanceof DescendantTreeNode && treeNode.parentGroup.id === "noteContent";

export const createPath = (path: string, groupId: GroupId, relationId: string) => {
  return `${path}/${groupId}/${relationId}`;
};
