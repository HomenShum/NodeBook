import { Tree } from "@/app/tree/Tree";
import { DescendantTreeNode, RootTreeNode, SublistRootTreeNode, TreeNode } from "@/app/tree/nodes";
import { createDescendantTreeNodesById } from "@/app/tree/utils";
import logger from "@/lib/logger";
import { comparePositions, compareTimestamps } from "@/app/util";

export class SublistTree extends Tree {
  get state() {
    logger.debug("Creating sublist tree");
    const rootTreeNode: RootTreeNode = new SublistRootTreeNode({ tree: this }).hydrate();
    this.applyFilter(rootTreeNode);
    this.applySearch(rootTreeNode);
    this.applySort(rootTreeNode);
    return {
      root: rootTreeNode,
      descendantTreeNodesById: createDescendantTreeNodesById(rootTreeNode),
    };
  }

  async createChildOfRootAndFocus() {
    const { node, relation } = await this.createChildNode({ parent: this.root });
    const path = this.root.childrenGroupsById.pointer.createChildPath(relation);
    this.setFocusedNode(path);
    return { node, relation, path };
  }

  protected applySort(treeNode: TreeNode) {
    const { mode, direction } = this.sortOption;
    const negation = direction === "asc" ? -1 : 1;

    const sortFn = (a: DescendantTreeNode, b: DescendantTreeNode) =>
      mode === "manual"
        ? comparePositions(a.position, b.position)
        : compareTimestamps(a.object[mode], b.object[mode], a.position, b.position) * negation;

    const walk = (node: TreeNode) => {
      node.childrenGroups.forEach((group) => {
        group.nodes.sort(sortFn);
        group.nodes.forEach(walk);
      });
    };

    walk(treeNode);
  }
}
