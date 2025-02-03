import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { DescendantTreeNode, PathToRootNode, RootTreeNode, TreeNode } from "@/app/tree/nodes";
import { Filter, Path, Root, Tree } from "@/app/tree/Tree";
import { createPath, isNoteContent, walkTree } from "@/app/tree/utils";
import { ObjectPath } from "@/app/util";
import logger from "@/lib/logger";

export class SearchTree extends Tree {
  private searchExpansions = new Set<string>();
  private searchRelations = new Set<string>();
  private hiddenRelations = new Set<string>();
  constructor(
    graphStore: GraphStore,
    settingsStore: SettingsStore,
    root: DescendantTreeNode | ObjectPath | GraphObject,
  ) {
    super(graphStore, settingsStore, root);
  }

  deepSearch(query: string) {
    let start = Date.now();
    this.search = query;
    if (query === "") {
      this.clearSearch(this.root);
      this.root.hydrate();
      return;
    }
    const results = this.graphStore.search({
      text: query,
      filters: {
        types: ["node"],
      },
    });

    // Filter out nodes that don't belong to the current user and are not public
    results.nodes = results.nodes.filter((n) => n.node.isPublic || n.node.authorId === this.graphStore.user.id);

    if (!(this.rootObject instanceof GraphNode)) {
      logger.warn("Root is not a node, this case isn't handled yet. Cancelling search.");
      return;
    }

    const relWithParentId = this.root.object.canonicalRelation?.id;
    let paths: Array<Array<string>> = [];
    const walkOnly = new Set(["canonical", "child"]);
    if (relWithParentId) {
      const exclude = new Set([relWithParentId]);
      // PATHFINDING code start. This is the heavy lifting.
      // Start is always the root ID, so we know its path is just "rootId"
      paths = this.graphStore.getAllPaths(
        this.rootObject,
        Array.from(results.nodes, (n) => n.node),
        exclude,
        walkOnly,
      );
    } else {
      paths = this.graphStore.getAllPaths(
        this.rootObject,
        Array.from(results.nodes, (n) => n.node),
      );
    }

    let end = Date.now();
    console.log("Time taken to get all paths", end - start);
    start = Date.now();
    this.searchRelations = new Set<string>(paths.flat());
    // For each relation path, create the tree path and expand it
    for (const path of paths) {
      let curPath = "";
      for (const rel of path) {
        // if the relation list associated with this relation is of type noteContent, then use 'noteContent' instead of 'all'
        const fromNodeId = this.graphStore.getRelationOrThrow(rel).from;
        const noteContent = this.graphStore.getRelationList(fromNodeId, "noteContent");
        const pinnedContentIds = this.graphStore.getRelationList(fromNodeId, "pinned").keys;
        if (noteContent.size > 0) {
          curPath = createPath(curPath, "noteContent", rel);
        } else if (pinnedContentIds.some((pinId) => pinId === rel)) {
          curPath = createPath(curPath, "pinned", rel);
        } else {
          curPath = createPath(curPath, "all", rel);
        }

        if (!(curPath in this.searchExpansions)) {
          this.setPathExpanded(curPath, true);
          this.searchExpansions.add(rel);
        }
      }
    }
    end = Date.now();
    console.log("Time taken to expand paths", end - start);
    start = Date.now();
    // EDGE CASE handling for getting ideal behaviour:
    // 1. If a node is a leaf node that we retrieved, we want to hide its relations but keep the node in the tree.
    // 2. If a node is a node along a path of the tree, we keep it but remove its non-path siblings.
    // 3. By maintaining this list of hidden relations, we can filter them out and edit the rest of the tree at will.

    // Add nodes to the hiddenRelations set and hide them initially. This is essential because upon each render we
    //  will check for these hidden relations in applyFilter. Otherwise, all hidden relations of a given node will be expanded upon
    //  editing of that node.
    const leafRelations = new Set<string>();
    // Sort the paths alphabetically. That way we can tell which one is a leaf rel. to the entire tree by seeing if the next has the
    // current as a prefix. I'm pretty proud of this - this alternative is you do an O(N^3) algorithm to process the paths in lockstep.
    let pathsJoined = paths.map((p) => p.join("/"));
    pathsJoined.sort();
    if (pathsJoined.length === 1) {
      leafRelations.add(pathsJoined[0].split("/").pop() as string);
    } else {
      for (let i = 0; i < pathsJoined.length - 1; i++) {
        if (!pathsJoined[i + 1].startsWith(pathsJoined[i])) {
          leafRelations.add(pathsJoined[i].split("/").pop() as string);
        }
      }
    }

    // Walk through and remove all nodes from the tree that are not leaves nor in the path of a search result.
    walkTree(this.root, (treeNode) => {
      if (treeNode instanceof DescendantTreeNode && leafRelations.has(treeNode.relationWithParent.id)) {
        // Set to unexpanded because by default it's expanded, and don't remove the node. We want to keep it in the tree.
        this.setPathExpanded(treeNode.path, false);
        return;
      }
      treeNode.childrenGroups.forEach((group) => {
        const newlyHidden = group.hydrate_subset(this.searchRelations);
        newlyHidden.forEach((rel) => this.hiddenRelations.add(rel));
      });
    });

    end = Date.now();
    console.log("Time taken to hide relations", end - start);
  }

  protected applyFilter(treeNode: TreeNode): boolean {
    // Straight copied from the original applyFilter method. We need to modify it slightly to filter out the hidden relations.
    const hidePointerSection = Object.getPrototypeOf(this).constructor.name === "Tree";
    function walk(treeNode: TreeNode, filter: Filter, hideSet: Set<string>): boolean {
      if (hidePointerSection) {
        treeNode.childrenGroupsById.pointer.nodes = [];
      }
      if (filter.hidePinnedSection) {
        treeNode.childrenGroupsById.pinned.nodes = [];
      }
      treeNode.childrenGroups.forEach((group) => {
        group.nodes = group.nodes.filter((child) => walk(child, filter, hideSet));
      });
      if (treeNode instanceof RootTreeNode) {
        return true;
      }
      if (filter.hideBackrelations && treeNode.isBackrelation) {
        return false;
      }
      /** Parent from the perspective of the graph, not the current tree */
      const isParentRelation =
        treeNode.isBackrelation &&
        (treeNode.relationWithParent.relationType.id === defaultRelationTypes.child.id ||
          treeNode.relationWithParent.relationType.id === defaultRelationTypes.sublist.id);

      const isSameRelationAsParentToGrandparent =
        treeNode.relationWithParent.id === treeNode.parent.relationWithParent?.id;
      const grandparentNotInBreadcrumb = !(treeNode.parent.parent instanceof PathToRootNode);
      const nodeIsNoteContent = isNoteContent(treeNode);
      if (filter.hideAllParents && isParentRelation) {
        return false;
      } else if (filter.hideAllRootParents && isParentRelation && treeNode.object.isRoot) {
        return false;
      } else if (
        filter.hideDirectParent &&
        isSameRelationAsParentToGrandparent &&
        grandparentNotInBreadcrumb &&
        !nodeIsNoteContent
      ) {
        return false;
      }
      const relId = treeNode.relationWithParent.id;

      // This is the only real difference from the original applyFilter. We check if the relation is in the hiddenRelations set
      // and if it is, we filter it out.
      if (hideSet.has(relId)) {
        return false;
      }
      return true;
    }
    return walk(treeNode, this.filter, this.hiddenRelations);
  }

  clearSearch(root: Root) {
    this.searchExpansions.clear();
    this.hiddenRelations.clear();
    this.searchRelations.clear();
    this.clear(root);
  }

  addToSearchExpansions(path: Path) {
    const relId = path.split("/").pop();
    if (relId) this.searchExpansions.add(relId);
  }

  removeFromSearchExpansions(path: Path) {
    const relId = path.split("/").pop();
    if (relId) this.searchExpansions.delete(relId);
  }

  setPathExpanded(path: Path, isExpanded: boolean) {
    if (isExpanded) {
      this.addToSearchExpansions(path);
    } else {
      this.removeFromSearchExpansions(path);
    }
    this.expansionsByPath.set(path, isExpanded);
  }

  togglePathExpanded(path: Path) {
    const newState = !this.expansionsByPath.get(path);
    if (newState === true) {
      this.addToSearchExpansions(path);
    } else {
      this.removeFromSearchExpansions(path);
    }
    this.expansionsByPath.set(path, newState);
  }
}
