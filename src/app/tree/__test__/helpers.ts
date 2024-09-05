import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { TreeNode } from "@/app/tree/nodes";
import { Tree } from "@/app/tree/Tree";

/**
 * Create a tree from a template. It instantiates an empty graph behind it and
 * creates the graph objects needed to represent the tree.
 *
 * If a single node is given, the tree will be created with that node as the
 * root. If an array of nodes is given, the tree's root will be set to the
 * default outline root node, and the templates will be used to create children
 * of the root.
 *
 * The template is a nested structure of objects, each representing a node in
 * the tree. The "rid" property is shorthand for the relationWithParent.id
 * property of the node. Since the identifier for tree nodes is the path to the
 * node, and since paths are based on relation ids, providing a relation id in
 * the template allows for reproducible tree paths (as opposed to if random
 * relation ids were generated).
 *
 * @example
 * const tree = await createTestTreeFromTemplate([
 *  { rid: "o1" },
 *  { rid: "o2", isHead: true, children: [
 *    { rid: "o3" }]},
 *  { rid: "o4", isAnchor: true }
 * ]);
 * // Defaults to the outline root node
 * assert(tree.root.object.id === "user-root-id");
 * // The rid property sets the relation id, which in turn sets the path
 * assert(tree.getNode("/all/o2/all/o3"));
 * // The isHead and isAnchor properties above are used to set the selection
 * assert(tree.selection.headNodeId === "/all/o2" && tree.selection.anchorNodeId === "/all/o4");
 *
 * @DesignNotes
 * We could've made the id property the path to the node, which is what it is in a real
 * tree node, but that would've made the template more verbose.
 *
 */
export async function createTestTreeFromTemplate(template: TemplateNode[]) {
  const settingsStore = new SettingsStore();
  const graphStore = new GraphStore();
  const tree = new Tree(graphStore, settingsStore, graphStore.userRoot);
  let selectionHeadPath: string | undefined;
  let selectionAnchorPath: string | undefined;
  let isFocusedPath: string | undefined;
  const queue: { node: TemplateNode; getParent: () => TreeNode }[] = template.map((node) => ({
    node,
    getParent: () => tree.root,
  }));
  // build tree
  while (queue.length > 0) {
    const { node, getParent } = queue.shift()!;
    const parent = getParent();
    const path = await parent.createChild({ relationProps: { id: node.rid }, after: -1 });
    tree.setPathExpanded(path, true);
    selectionHeadPath = selectionHeadPath || (node.isHead ? path : undefined);
    selectionAnchorPath = selectionAnchorPath || (node.isAnchor ? path : undefined);
    isFocusedPath = isFocusedPath || (node.isFocused ? path : undefined);
    for (const child of node.children || []) {
      queue.push({ node: child, getParent: () => tree.getNodeOrThrow(path) });
    }
  }
  // select
  if (selectionHeadPath) {
    tree.selectBetween(selectionAnchorPath || selectionHeadPath, selectionHeadPath);
  } else if (isFocusedPath) {
    tree.setFocusedNode(isFocusedPath);
  }
  return tree;
}

/**
 * Return a template representing the given tree.
 * The opposite of {@link createTestTreeFromTemplate}.
 */
export function toTemplate(tree: Tree): TemplateNode {
  const sel = tree.selection;
  function toTemplateNode(treeNode: TreeNode): TemplateNode {
    const res: TemplateNode = {
      rid: treeNode.relationWithParent?.id ?? "",
    };
    const children = treeNode.visibleChildren.map(toTemplateNode);
    if (children.length > 0) {
      res.children = children;
    }
    if (!sel) return res;
    if (sel.type === "node") {
      if (sel.headNodeId === treeNode.id) {
        res.isHead = true;
      }
      if (sel.anchorNodeId === treeNode.id) {
        res.isAnchor = true;
      }
    } else if (sel.type === "editor") {
      if (sel.treeNodeId === treeNode.id) {
        res.isFocused = true;
      }
    }
    return res;
  }
  return toTemplateNode(tree.root);
}

/**
 * Utility function to define a trees expected structure and selection in a
 * test using a template.
 */
export function expectTreeToMatchTemplate(tree: Tree, template: TreeTemplate) {
  const actual = toTemplate(tree);
  if (Array.isArray(template)) {
    expect(actual.children).toEqual(template);
  } else {
    expect(actual).toEqual(template);
  }
}

export type TreeTemplate = TemplateNode | TemplateNode[];
export type TemplateNode = {
  rid: string;
  children?: TemplateNode[];
  isHead?: boolean;
  isAnchor?: boolean;
  isFocused?: boolean;
};
