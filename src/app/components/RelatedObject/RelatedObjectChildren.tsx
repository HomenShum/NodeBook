import { GraphNode } from "@/app/model/GraphNode";
import { GraphObject } from "@/app/model/GraphObject";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { ViewStore } from "@/app/model/ViewStore";
import { PathLink, comparePositions, relationsPathToParentChild, relationsToPathStr } from "@/app/util";
import { observer } from "mobx-react-lite";
import { GraphRelation } from "../../model/GraphRelation";
import { useViewStore } from "../../store/useViewStore";
import { RelatedObjectView } from "./RelatedObjectView";

export const RelatedObjectChildren = observer(
  ({
    pathToParentRelations,
    searchResult,
  }: {
    pathToParentRelations: GraphRelation[];
    searchResult?: Map<string, boolean>;
  }) => {
    const viewStore = useViewStore();
    const depth = pathToParentRelations.length;

    const pathToParent = relationsPathToParentChild(pathToParentRelations);
    const children = getFilteredChildrenAtPath(pathToParent, viewStore, searchResult);

    const parent = pathToParent[pathToParent.length - 1].child;

    const bundles = parent.children.filter((c) => c instanceof GraphNode && c.isBundle);
    const findRelationsFirstBundle = (r: GraphRelation) =>
      bundles.find((b) => b.children.map((o) => o.id).includes(r.id));

    let lastBundleId: string | undefined;
    return (
      <div className={depth > 0 ? "ml-5" : ""}>
        {children.map(({ relation: childRelation, position }, i) => {
          const firstBundle = findRelationsFirstBundle(childRelation);
          const newBundle = firstBundle?.id !== lastBundleId;
          lastBundleId = firstBundle?.id;
          return (
            <>
              {newBundle && <div className="border-t border-black" />}
              <RelatedObjectView
                key={relationsToPathStr([...pathToParentRelations, childRelation])}
                path={[...pathToParentRelations, childRelation]}
                position={position}
                siblingAbove={children[i - 1]?.relation}
                siblingBelow={children[i + 1]?.relation}
                searchResult={searchResult}
              />
            </>
          );
        })}
      </div>
    );
  },
);

export const getFilteredChildrenAtPath = (
  path: PathLink[],
  viewStore: ViewStore,
  searchResult?: Map<string, boolean>,
) => {
  if (path.length === 0) {
    return [];
  }
  const node = path[path.length - 1].child;
  const grandparent = path[path.length - 2]?.child;
  return node.relationsWithPositions
    .sort((a, b) => comparePositions(a.position, b.position))
    .filter(({ relation }) => {
      let childNode: GraphObject;
      if (relation.from.id === node.id) {
        childNode = relation.to;
      } else if (relation.to.id === node.id) {
        childNode = relation.from;
      } else {
        throw new Error("Relation does not connect to parent");
      }
      const isBundle = childNode instanceof GraphNode && childNode.isBundle;
      return (
        !(viewStore.hideBundles && isBundle) &&
        filterFocusedNodesRelations(viewStore, relation, childNode, grandparent) &&
        (!searchResult || searchResult.get(childNode.id))
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
  viewStore: ViewStore,
  r: GraphRelation,
  relatedNode: GraphObject,
  precedingFocusedNodeInPath?: GraphObject,
) {
  /** The relation points from the related node to the focused node */
  const isBackwards = r.from.id === relatedNode.id;
  if (viewStore.hideBackrelations && isBackwards) {
    return false;
  }
  /** Parent from the perspective of the graph, not the current tree */
  const isGraphParent = isBackwards && r.relationType.id === defaultRelationTypes.child.id;
  if (viewStore.hideAllParents && isGraphParent) {
    return false;
  } else if (viewStore.hideAllRootParents && isGraphParent && relatedNode.isRoot) {
    return false;
  } else if (viewStore.hideDirectParent && relatedNode.id === precedingFocusedNodeInPath?.id) {
    return false;
  }
  return true;
}
