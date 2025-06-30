import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import {
  DescendantTreeNode,
  GroupId,
  PathToRootNode,
  RootTreeNode,
  TreeNode,
} from "@/app/tree/nodes";
import { Filter, Path, Root, Tree } from "@/app/tree/Tree";
import { createPath, isNoteContent, walkTree } from "@/app/tree/utils";
import { ObjectPath, Position } from "@/app/util";
import logger from "@/lib/logger";

export class SearchTree extends Tree {
  private tempNodes: GraphNode[] = [];
  private tempPaths: string[] = [];
  private searchExpansions = new Set<string>();
  private searchRelations = new Set<string>();
  private hiddenRelations = new Set<string>();
  private alwaysVisibleNodes = new Set<string>();
  isMainSearchTree: boolean;

  /**
   * Stores information about filtered nodes during search
   * Map structure: { parentPath -> { groupId -> filteredNodes[] } }
   */
  public filteredNodesByPath: Map<string, Record<GroupId, DescendantTreeNode[]>> = new Map();

  constructor(
    graphStore: GraphStore,
    settingsStore: SettingsStore,
    root: DescendantTreeNode | ObjectPath | GraphObject,
    isMainSearchTree?: boolean,
  ) {
    super(graphStore, settingsStore, root);
    this.isMainSearchTree = isMainSearchTree ?? false;
  }

  addTempPath(node: GraphNode, path: string) {
    if (node.canonicalRelationId) {
      this.hiddenRelations.delete(node.canonicalRelationId);
    }
    this.setPathExpanded(path, true);
    this.tempNodes.push(node);
    this.tempPaths.push(path);
  }

  deepSearch(query: string) {
    let start = Date.now();

    // Clean up any deleted nodes from alwaysVisibleNodes
    this.cleanupAlwaysVisibleNodes();

    // Reset the temp nodes and paths if the query has changed
    if (query !== this.search) {
      this.tempNodes = [];
      this.tempPaths = [];

      // Clear filtered nodes when the query changes
      this.filteredNodesByPath.clear();
    }
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

    // Add nodes in alwaysVisibleNodes to the search results if they're not already included
    const searchResultIds = new Set(results.nodes.map((r) => r.node.id));
    const additionalNodes: GraphNode[] = [];
    for (const nodeId of this.alwaysVisibleNodes) {
      if (!searchResultIds.has(nodeId)) {
        const node = this.graphStore.getNode(nodeId);
        if (node) {
          additionalNodes.push(node);
        }
      }
    }

    const nodesToWalk = [...this.tempNodes, ...Array.from(results.nodes, (n) => n.node), ...additionalNodes];

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
      paths = this.graphStore.getAllPaths(this.rootObject, nodesToWalk, exclude, walkOnly);
    } else {
      paths = this.graphStore.getAllPaths(this.rootObject, nodesToWalk, new Set(), walkOnly);
    }

    let end = Date.now();
    start = Date.now();
    this.searchRelations = new Set<string>(paths.flat());

    // Note: We no longer need to call loadWithBFS here since search results
    // are already loaded by the search API and we don't need their full layers

    // For each relation path, create the tree path and expand it
    for (const path of paths) {
      let curPath = "";
      for (const rel of path) {
        // if the relation list associated with this relation is of type noteContent, then use 'noteContent' instead of 'all'
        try {
          const relation = this.graphStore.getRelation(rel);
          if (!relation) {
            logger.warn("Skipping invalid relation in search path:", rel);
            continue;
          }

          const fromNodeId = relation.from;
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
        } catch (error) {
          logger.warn("Error processing relation in search path:", rel, error);
          continue;
        }
      }
    }
    end = Date.now();
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
    // This is where hydrate_subset will be called and filtered nodes will be populated
    walkTree(this.root, (treeNode) => {
      if (this.tempPaths.includes(treeNode.path)) {
        this.setPathExpanded(treeNode.path, true);
        return;
      }
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

    this.applyFilter(this.root);

    end = Date.now();
  }

  protected applyFilter(treeNode: TreeNode): boolean {
    // Clean up deleted nodes from alwaysVisibleNodes before filtering
    this.cleanupAlwaysVisibleNodes();

    // Straight copied from the original applyFilter method. We need to modify it slightly to filter out the hidden relations.
    const hidePointerSection = Object.getPrototypeOf(this).constructor.name === "Tree";
    const graphStore = this.graphStore; // Capture reference for use in nested function
    const alwaysVisible = this.alwaysVisibleNodes; // Capture reference for nested function

    function walk(treeNode: TreeNode, filter: Filter, hideSet: Set<string>, alwaysVisible: Set<string>): boolean {
      if (hidePointerSection) {
        treeNode.childrenGroupsById.pointer.nodes = [];
      }
      if (filter.hidePinnedSection) {
        treeNode.childrenGroupsById.pinned.nodes = [];
      }

      // Process children first
      treeNode.childrenGroups.forEach((group) => {
        group.nodes = group.nodes.filter((child) => walk(child, filter, hideSet, alwaysVisible));
      });

      // After processing children, check if this node has any visible children in alwaysVisibleNodes
      let hasAlwaysVisibleChildren = false;
      if (treeNode.childrenGroups) {
        for (const group of treeNode.childrenGroups) {
          for (const child of group.nodes) {
            if (alwaysVisible.has(child.object.id)) {
              hasAlwaysVisibleChildren = true;
              break;
            }
          }
          if (hasAlwaysVisibleChildren) break;
        }
      }

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

      // Check if this node should always be visible (newly created during search)
      if (alwaysVisible.has(treeNode.object.id)) {
        // Verify the node and its relation actually still exist
        const objectExists = !!treeNode.object && treeNode.object.id !== undefined;
        const relationExists =
          treeNode.relationWithParent &&
          !!treeNode.relationWithParent.id &&
          !!treeNode.relationWithParent.from &&
          !!treeNode.relationWithParent.to;

        // Additional check: verify the relation still exists in GraphStore
        const relationInStore = relationExists
          ? !!treeNode.relationWithParent && !!graphStore.getRelation(treeNode.relationWithParent.id)
          : false;

        if (objectExists && relationExists && relationInStore) {
          return true;
        } else {
          alwaysVisible.delete(treeNode.object.id);
          // Continue with normal filtering logic
        }
      }

      // NEW: Check if this node should be visible because it has newly created children
      if (hasAlwaysVisibleChildren) {
        return true;
      }

      // This is the only real difference from the original applyFilter. We check if the relation is in the hiddenRelations set
      // and if it is, we filter it out.
      if (hideSet.has(relId)) {
        return false;
      }
      return true;
    }
    return walk(treeNode, this.filter, this.hiddenRelations, this.alwaysVisibleNodes);
  }

  clearSearch(root: Root) {
    this.searchExpansions.clear();
    this.hiddenRelations.clear();
    this.searchRelations.clear();
    this.alwaysVisibleNodes.clear();
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

  /**
   * Clean up deleted nodes from alwaysVisibleNodes set
   * Also verify that all tracked nodes still have valid relations
   */
  private cleanupAlwaysVisibleNodes() {
    const toRemove: string[] = [];

    for (const objectId of this.alwaysVisibleNodes) {
      const object = this.graphStore.getObject(objectId);
      if (!object) {
        toRemove.push(objectId);
        continue;
      }

      // Additional validation: check if the object's relations are still valid
      if (object instanceof GraphNode || object instanceof GraphRelation) {
        try {
          // Verify the object's relations still exist in the GraphStore
          const relations = object.relations;
          for (const relation of relations) {
            if (!this.graphStore.getRelation(relation.id)) {
              logger.warn("Object has invalid relation reference:", objectId, relation.id);
            }
          }
        } catch (error) {
          logger.warn("Error validating relations for object:", objectId, error);
          // If there are validation errors, consider removing from alwaysVisible
          toRemove.push(objectId);
        }
      }
    }

    toRemove.forEach((objectId) => this.alwaysVisibleNodes.delete(objectId));
  }

  /**
   * Gets contiguous groups of filtered nodes for a given parent path and group
   * This method validates node existence on-demand to handle deletions
   */
  public getContiguousFilteredGroups(parentPath: string, groupId: GroupId): DescendantTreeNode[][] {
    const filteredNodesMap = this.filteredNodesByPath.get(parentPath);
    if (!filteredNodesMap) return [];

    const storedGroups = (filteredNodesMap as any)[`${groupId}_contiguous`] || [];

    // Validate and filter out deleted nodes from each group
    const validGroups: DescendantTreeNode[][] = [];

    const unfilteredNodes = this.getNode(parentPath)?.childrenGroupsById[groupId]?.nodes;

    const filteredNodes = storedGroups.flat();

    if (!unfilteredNodes) {
      if (filteredNodes.length === 0) {
        return [];
      }
      return [filteredNodes.sort(this.sortFunction.bind(this))];
    }

    const unFilteredNodesSet = new Set(unfilteredNodes.map((node) => node.id));

    const sortedNodes = [...unfilteredNodes, ...filteredNodes].sort(this.sortFunction.bind(this));

    let currentGroup: DescendantTreeNode[] = [];
    for (const node of sortedNodes) {
      if (unFilteredNodesSet.has(node.id)) {
        if (currentGroup.length > 0) {
          validGroups.push(currentGroup);
          currentGroup = [];
        }
        continue;
      }

      currentGroup.push(node);
    }

    // Only include groups that still have valid nodes
    if (currentGroup.length > 0) {
      validGroups.push(currentGroup);
    }

    // Update the stored data with cleaned groups
    if (validGroups.length !== storedGroups.length) {
      (filteredNodesMap as any)[`${groupId}_contiguous`] = validGroups;
    }

    return validGroups;
  }

  /**
   * Gets position information for filtered node groups, validating node existence
   * This method uses the validated contiguous groups to ensure positions are accurate
   */
  public getFilteredGroupPositions(parentPath: string, groupId: GroupId): { position: Position; groupIndex: number }[] {
    // Use our validated contiguous groups method
    const contiguousGroups = this.getContiguousFilteredGroups(parentPath, groupId);

    if (contiguousGroups.length === 0) {
      return [];
    }

    return contiguousGroups.map((group, groupIndex) => {
      // Since the nodes are contiguous, we can use any node's position as the anchor position
      const firstNode = group[0];
      return {
        position: firstNode.position,
        groupIndex,
      };
    });
  }
}
