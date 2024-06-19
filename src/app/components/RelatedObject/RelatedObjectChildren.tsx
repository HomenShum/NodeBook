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

import styles from "./RelatedObjectChildren.module.css";

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
      <div className={pathToParentRelations.length > 0 ? styles.NodeIndentation : ""}>
        {pinnedChildren.length > 0 && (
          <>
            <button
              onClick={() => setIsPinnedVisible(!isPinnedVisible)}
              className={`${styles.PinnedToggleButton}  ${
                isPinnedVisible ? styles.PinnedToggleButton_PinnedVisible : styles.PinnedToggleButton_PinnedHidden
              }`}
            >
              <span
                className={`${styles.PinIcon} ${
                  isPinnedVisible ? styles.PinIcon_PinnedVisible : styles.PinIcon_PinnedHidden
                }`}
              >
                <PinCustom />
              </span>
              {isPinnedVisible ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {isPinnedVisible && (
              <div className={styles.PinSection}>
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
                <div
                  className={`${styles.PinSectionSeparator} ${
                    parent === graphStore.thoughtstreamRoot ? styles.StreamSpacing : styles.DefaultSpacing
                  }`}
                />
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
                    className={`${styles.BundleSeparator} ${
                      i === 0
                        ? `${styles.FirstBundle} ${
                            displayDate ? styles.FirstBundle_WithDate : styles.FirstBundle_NoDate
                          }`
                        : styles.DefaultBundle
                    }`}
                  />
                  {displayDate && (
                    <div className={styles.DateLabel}>
                      <span className={styles.DateLabelContent}>{currentDate}</span>
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
          <button onClick={() => setShowAll && setShowAll(true)} className={styles.ShowAll}>
            Show all
          </button>
        )}
      </div>
    );
  },
);
