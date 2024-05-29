import { GraphNode } from "@/app/model/GraphNode";
import { GraphObject } from "@/app/model/GraphObject";
import { GraphRelation } from "@/app/model/GraphRelation";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { SettingsStore } from "@/app/model/SettingsStore";
import { SearchResult } from "@/app/model/search";
import { PathLink, comparePositions } from "@/app/util";

export const getFilteredChildrenAtPath = (
  path: PathLink[],
  settingsStore: SettingsStore,
  searchResult: Map<string, SearchResult> | undefined,
  searchResultDate: Date,
  pinned: boolean,
) => {
  if (path.length === 0) {
    return [];
  }
  const node = path.length > 0 ? path[path.length - 1].child : undefined;
  if (!node) {
    return [];
  }
  const grandparent = path.length > 1 ? path[path.length - 2]?.child : undefined;
  return (pinned ? node.pinnedRelationsWithPositions : node.relationsWithPositions)
    .sort((a, b) => comparePositions(a.position, b.position))
    .filter(({ relation }) => {
      let childNode: GraphObject;
      if (relation.from.id === node.id) {
        childNode = relation.to;
      } else if (relation.to.id === node.id) {
        childNode = relation.from;
      } else {
        console.error("Relation does not connect to parent", relation.id, node.id);
        return false;
      }

      const objectCount = path.reduce((acc, { child }) => (child.id === childNode.id ? acc + 1 : acc), 0);
      const isBundle = childNode instanceof GraphNode && childNode.isBundle;
      return (
        !(settingsStore.hideBundles && isBundle) &&
        filterFocusedNodesRelations(settingsStore, relation, childNode, grandparent) &&
        (!searchResult ||
          relation.createdAt > searchResultDate ||
          (searchResult.get(childNode.id)?.display && objectCount === 0))
      );
    });
};

/**
 * TODO: This is still conceptually messy imo
 *
 * You've traversed a path from the root to a particular node. That node has a
 * list of relation it's involved in. Filter those relations according to the
 * view settings.
 *
 * ## Example:
 *
 * - Projects                   // pathParentOfFocusedNode
 *   - Mew                      // focusedNode
 *     - Features               // relatedNode
 *     - Bugs                   // relatedNode
 *     - parent: Projects       // relatedNode
 *     - parent: Root           // relatedNode
 *
 * ### Filter all parents
 * Filter all relations which are parent/child, where the parent is the related
 * node
 *
 * - Projects
 *   - Mew
 *     - Features
 *     - Bugs
 *
 * ### Filter all root parents
 * Filter all relations which are parent/child, where the parent is the related
 * node and the parent is a special root node
 *
 * - Projects
 *   - Mew
 *     - Features
 *     - Bugs
 *     - parent: Projects
 *
 * ### Filter direct parent
 * Filter all relations which are parent/child, where the parent is the related
 * node and the node directly precedes the focused node in the current path
 *
 * - Projects
 *   - Mew
 *     - Features
 *     - Bugs
 *     - parent: Root
 *
 */
function filterFocusedNodesRelations(
  settingsStore: SettingsStore,
  r: GraphRelation,
  relatedNode: GraphObject,
  precedingFocusedNodeInPath?: GraphObject,
) {
  /** The relation points from the related node to the focused node */
  const isBackwards = r.from.id === relatedNode.id;
  if (settingsStore.hideBackrelations && isBackwards) {
    return false;
  }
  /** Parent from the perspective of the graph, not the current tree */
  const isGraphParent = isBackwards && r.relationType.id === defaultRelationTypes.child.id;
  if (settingsStore.hideAllParents && isGraphParent) {
    return false;
  } else if (settingsStore.hideAllRootParents && isGraphParent && relatedNode.isRoot) {
    return false;
  } else if (settingsStore.hideDirectParent && relatedNode.id === precedingFocusedNodeInPath?.id) {
    return false;
  }
  return true;
}
