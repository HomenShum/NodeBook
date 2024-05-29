import { GraphNode } from "@/app/model/GraphNode";
import { GraphObject } from "@/app/model/GraphObject";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { SettingsStore } from "@/app/model/SettingsStore";
import { useGraphStore } from "@/app/model/useGraphStore";
import { useSettingsStore } from "@/app/model/useSettingsStore";
import { SearchResult } from "@/app/store/search";
import { PathLink, comparePositions, formatDate, relationsPathToParentChild, relationsToPathStr } from "@/app/util";
import { ChevronDown, ChevronRight } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Dispatch, SetStateAction, useState } from "react";
import { GraphRelation } from "../../model/GraphRelation";
import { PinCustom } from "../icons/icons";
import { RelatedObjectView } from "./RelatedObjectView";

export const RelatedObjectChildren = observer(
  ({
    pathToParentRelations,
    searchResult,
    searchResultDate,
    showAll = true,
    setShowAll,
  }: {
    pathToParentRelations: GraphRelation[];
    searchResult?: Map<string, SearchResult>;
    searchResultDate: Date;
    showAll?: boolean;
    setShowAll?: Dispatch<SetStateAction<boolean>>;
  }) => {
    const settingsStore = useSettingsStore();
    const depth = pathToParentRelations.length;
    const graphStore = useGraphStore();
    const pathToParent = relationsPathToParentChild(pathToParentRelations);
    const children = getFilteredChildrenAtPath(pathToParent, settingsStore, searchResult, searchResultDate, false);

    const pinnedChildren = getFilteredChildrenAtPath(pathToParent, settingsStore, searchResult, searchResultDate, true);

    const [isPinnedVisible, setIsPinnedVisible] = useState(true);
    const togglePinnedVisibility = () => setIsPinnedVisible(!isPinnedVisible);

    const parent = pathToParent[pathToParent.length - 1].child;

    const bundles = parent.children.filter((c) => c instanceof GraphNode && c.isBundle);
    const findRelationsFirstBundle = (r: GraphRelation) =>
      bundles.find((b) => b.children.map((o) => o.id).includes(r.id));

    let lastBundleId: string | undefined;
    let lastDisplayedDate: string | undefined;

    return (
      <div className={depth > 0 ? "ml-[16px]" : ""}>
        {pinnedChildren.length > 0 && (
          <>
            <button
              onClick={togglePinnedVisibility}
              className={`flex gap-[2px] relative top-0  uppercase text-xs  w-fit px-1 py-1 rounded-md text-[--gray-7] z-10 ${
                parent === graphStore.thoughtstreamRoot ? "left-0" : "left-1"
              }  ${
                isPinnedVisible ? "bg-[--teal-1] hover:bg-[--teal-2] mb-0" : "bg-[--gray-1] hover:bg-[--gray-2] mb-3"
              }`}
            >
              <span className={` scale-[0.80] ${isPinnedVisible ? "text-[--teal-9]" : "text-[--gray-7]"}`}>
                <PinCustom />
              </span>
              {isPinnedVisible ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {isPinnedVisible && (
              <div
                className={`border-[--teal-4] border-b  pt-3  ${
                  parent === graphStore.thoughtstreamRoot ? "-mb-2 pb-4" : "mb-3 pb-0"
                } `}
              >
                {isPinnedVisible &&
                  pinnedChildren.map(({ relation: childRelation, position }, i) => {
                    return (
                      <div key={relationsToPathStr([...pathToParentRelations, childRelation])}>
                        <RelatedObjectView
                          path={[...pathToParentRelations, childRelation]}
                          position={position}
                          siblingAbove={pinnedChildren[i - 1]?.relation}
                          siblingBelow={pinnedChildren[i + 1]?.relation}
                          searchResult={searchResult}
                          searchResultDate={searchResultDate}
                        />
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
        {(showAll ? children : children.slice(0, 100)).map(({ relation: childRelation, position }, i) => {
          const firstBundle = findRelationsFirstBundle(childRelation);
          const newBundle = firstBundle?.id !== lastBundleId;
          const currentDate = formatDate(firstBundle?.createdAt);
          const displayDate = newBundle && currentDate !== lastDisplayedDate;
          lastBundleId = firstBundle?.id;
          if (displayDate) {
            lastDisplayedDate = currentDate;
          }
          return (
            <div key={relationsToPathStr([...pathToParentRelations, childRelation])}>
              {newBundle && (
                <>
                  <div
                    className={`border-t border-dashed border-[--gray-5] ${
                      i === 0 ? `mt-2 pt-2 border-none ${displayDate ? "pb-4" : "mb-2"}` : "mt-3 mb-4 pt-2"
                    }`}
                  />
                  {displayDate && (
                    <div className="relative -translate-y-8 w-fit left-1/2 text-[--gray-8] text-[12px] -translate-x-1/2 z-10 h-0">
                      <span className="bg-white px-1">{currentDate}</span>
                    </div>
                  )}
                </>
              )}
              <RelatedObjectView
                path={[...pathToParentRelations, childRelation]}
                position={position}
                siblingAbove={children[i - 1]?.relation}
                siblingBelow={children[i + 1]?.relation}
                searchResult={searchResult}
                searchResultDate={searchResultDate}
              />
            </div>
          );
        })}
        {!showAll && children.length > 100 && (
          <button onClick={() => setShowAll && setShowAll(true)} className="text-blue-400">
            Show all
          </button>
        )}
      </div>
    );
  },
);

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

export default RelatedObjectChildren;

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
