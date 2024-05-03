import { ViewController } from "@/app/controller/ViewController";
import { GraphNode } from "@/app/model/GraphNode";
import { GraphObject } from "@/app/model/GraphObject";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { SearchResult } from "@/app/store/search";
import { PathLink, comparePositions, relationsPathToParentChild, relationsToPathStr } from "@/app/util";
import { cn } from "@/lib/utils";
import { observer } from "mobx-react-lite";
import { useViewController } from "../../controller/useViewController";
import { GraphRelation } from "../../model/GraphRelation";
import { RelatedObjectView } from "./RelatedObjectView";

export const RelatedObjectChildren = observer(
  ({
    pathToParentRelations,
    searchResult,
  }: {
    pathToParentRelations: GraphRelation[];
    searchResult?: Map<string, SearchResult>;
  }) => {
    const viewController = useViewController();
    const depth = pathToParentRelations.length;

    const pathToParent = relationsPathToParentChild(pathToParentRelations);
    const children = getFilteredChildrenAtPath(pathToParent, viewController, searchResult, false);
    const pinnedChildren = getFilteredChildrenAtPath(pathToParent, viewController, searchResult, true).reverse();

    const parent = pathToParent[pathToParent.length - 1].child;

    const bundles = parent.children.filter((c) => c instanceof GraphNode && c.isBundle);
    const findRelationsFirstBundle = (r: GraphRelation) =>
      bundles.find((b) => b.children.map((o) => o.id).includes(r.id));

    let lastBundleId: string | undefined;
    return (
      <div className={depth > 0 ? "ml-5" : ""}>
        <div className={cn(pinnedChildren.length > 0 && "border-red-500 border-b")}>
          {pinnedChildren.map(({ relation: childRelation, position }, i) => {
            return (
              <div key={relationsToPathStr([...pathToParentRelations, childRelation])}>
                <RelatedObjectView
                  path={[...pathToParentRelations, childRelation]}
                  position={position}
                  siblingAbove={pinnedChildren[i - 1]?.relation}
                  siblingBelow={pinnedChildren[i + 1]?.relation}
                  searchResult={searchResult}
                />
              </div>
            );
          })}
        </div>

        {children.map(({ relation: childRelation, position }, i) => {
          const firstBundle = findRelationsFirstBundle(childRelation);
          const newBundle = firstBundle?.id !== lastBundleId;
          lastBundleId = firstBundle?.id;
          return (
            <div key={relationsToPathStr([...pathToParentRelations, childRelation])}>
              {newBundle && <div className="border-t border-grey-400 border-dashed" />}
              <RelatedObjectView
                path={[...pathToParentRelations, childRelation]}
                position={position}
                siblingAbove={children[i - 1]?.relation}
                siblingBelow={children[i + 1]?.relation}
                searchResult={searchResult}
              />
            </div>
          );
        })}
      </div>
    );
  },
);

export const getFilteredChildrenAtPath = (
  path: PathLink[],
  viewController: ViewController,
  searchResult: Map<string, SearchResult> | undefined,
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
        throw new Error("Relation does not connect to parent");
      }

      const objectCount = path.reduce((acc, { child }) => (child.id === childNode.id ? acc + 1 : acc), 0);
      const isBundle = childNode instanceof GraphNode && childNode.isBundle;
      return (
        !(viewController.hideBundles && isBundle) &&
        filterFocusedNodesRelations(viewController, relation, childNode, grandparent) &&
        (!searchResult || (searchResult.get(childNode.id)?.display && objectCount === 0))
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
  viewController: ViewController,
  r: GraphRelation,
  relatedNode: GraphObject,
  precedingFocusedNodeInPath?: GraphObject,
) {
  /** The relation points from the related node to the focused node */
  const isBackwards = r.from.id === relatedNode.id;
  if (viewController.hideBackrelations && isBackwards) {
    return false;
  }
  /** Parent from the perspective of the graph, not the current tree */
  const isGraphParent = isBackwards && r.relationType.id === defaultRelationTypes.child.id;
  if (viewController.hideAllParents && isGraphParent) {
    return false;
  } else if (viewController.hideAllRootParents && isGraphParent && relatedNode.isRoot) {
    return false;
  } else if (viewController.hideDirectParent && relatedNode.id === precedingFocusedNodeInPath?.id) {
    return false;
  }
  return true;
}
