import { Tree } from "@/app/tree/Tree";
import { RootTreeNode, SublistRootTreeNode } from "@/app/tree/nodes";
import { createDescendantTreeNodesById } from "@/app/tree/utils";
import logger from "@/lib/logger";

export class SublistTree extends Tree {
  get state() {
    logger.debug("Creating sublist tree");
    const rootTreeNode: RootTreeNode = new SublistRootTreeNode({ tree: this }).hydrate();
    this.applyFilter(rootTreeNode);
    this.applySearch(rootTreeNode);
    return {
      root: rootTreeNode,
      descendantTreeNodesById: createDescendantTreeNodesById(rootTreeNode),
    };
  }
}
