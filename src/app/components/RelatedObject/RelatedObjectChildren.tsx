import { ChevronDown, ChevronRight } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Dispatch, SetStateAction, useState } from "react";

import { PinCustom } from "@/app/components/icons";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { SearchResult } from "@/app/graph/search";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { formatDate, relationsPathToParentChild, relationsToPathStr } from "@/app/util";

import { RelatedObjectView } from "./RelatedObjectView";
import { getFilteredChildrenAtPath } from "./getFilteredChildrenAtPath";

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
    const graphStore = useGraphStore();
    const pathToParent = relationsPathToParentChild(pathToParentRelations);
    let children = getFilteredChildrenAtPath(pathToParent, settingsStore, searchResult, searchResultDate, false);
    if (settingsStore.hidePinnedItems) {
      children = children.filter((c) => !graphStore.correspondingPinnedForObjects.has(c.relation.id));
    }
    const pinnedChildren = getFilteredChildrenAtPath(pathToParent, settingsStore, searchResult, searchResultDate, true);

    const [isPinnedVisible, setIsPinnedVisible] = useState(true);

    const parent = pathToParent[pathToParent.length - 1].child;
    const bundles = parent.children.filter((c) => c instanceof GraphNode && c.isBundle);
    const findRelationsFirstBundle = (r: GraphRelation) =>
      bundles.find((b) => b.children.map((o) => o.id).includes(r.id));

    let lastBundleId: string | undefined;
    let lastDisplayedDate: string | undefined;

    return (
      <div className={pathToParentRelations.length > 0 ? "ml-[16px]" : ""}>
        {pinnedChildren.length > 0 && (
          <>
            <button
              onClick={() => setIsPinnedVisible(!isPinnedVisible)}
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
