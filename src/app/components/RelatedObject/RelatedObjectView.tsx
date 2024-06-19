import * as HoverCard from "@radix-ui/react-hover-card";
import { Circle, Dot, GlobeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import styles from "@/app/components/RelatedObject/RelatedObjectView.module.css";
import { PinCustom } from "@/app/components/icons";
import { GraphRelation } from "@/app/graph/GraphRelation";
import { defaultRelationTypes } from "@/app/graph/GraphStore";
import { SearchResult } from "@/app/graph/search";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useRenderController } from "@/app/render/useRenderController";
import {
  Position,
  countOccurrencesInPath,
  pathToNodeSet,
  relationsPathToParentChild,
  relationsToPathStr,
  relationsToURLPath,
  useCurView,
} from "@/app/util";
import { useTree } from "@/app/view/Tree";
import { ViewType } from "@/app/view/ViewType";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

import { RelatedObjectChildren } from "./RelatedObjectChildren";
import { RelationAtPathProvider } from "./RelatedObjectContext";
import { RelatedObjectDetails } from "./RelatedObjectDetails";
import { RelatedObjectEditor } from "./RelatedObjectEditor";
import { RelatedObjectMenu } from "./RelatedObjectMenu";
import { RelationCombobox } from "./RelationCombobox";
import { ReplaceRelatedNodeView } from "./ReplaceRelatedNodeView";
import Toggle from "./Toggle";
import { ViewTypeProvider } from "./ViewTypeContext";
import { getFilteredChildrenAtPath } from "./getFilteredChildrenAtPath";

/**
 * The view type of the related object. This determines what is displayed in the
 * related object view.
 * - `edit`: The default view where edits update the object content (or create a
 *   new object when it's rendered as a link)
 * - `replace`: The view where the user can replace the object with another
 *   object.
 */
export type RelatedObjectViewType = "edit" | "replace";

const canvas = document.createElement("canvas");

function getTextWidth(text: string, font: string) {
  const context = canvas.getContext("2d")!;
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

export const RelatedObjectView = observer(
  ({
    path,
    position,
    siblingAbove,
    siblingBelow,
    searchResult,
    searchResultDate,
  }: {
    path: GraphRelation[];
    position: Position;
    siblingAbove?: GraphRelation;
    siblingBelow?: GraphRelation;
    searchResult?: Map<string, SearchResult>;
    searchResultDate: Date;
  }) => {
    const settingsStore = useSettingsStore();
    const tree = useTree();
    const viewStore = useViewStore();
    const renderController = useRenderController();
    const graphStore = useGraphStore();

    // computed values
    const relation = path[path.length - 1];
    const pathToParentRelations = path.slice(0, path.length - 1);
    const pathToNodeStr = relationsToPathStr(path);
    const pathObjects = relationsPathToParentChild(path);
    const { parent, child: object } = pathObjects[pathObjects.length - 1];
    const viewRoot = pathObjects[0].child; // TODO messy conceptually

    // TODO: this was really shoehorned in here for demo day and should be refactored
    const [updatingRelationType, setUpdatingRelationType] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [viewType, setViewType] = useState<RelatedObjectViewType>("edit");

    // children state
    const isExpanded = tree.isPathExpanded(pathToNodeStr);
    const [searchExpansion, setSearchExpansion] = useState(false);
    const children = getFilteredChildrenAtPath(pathObjects, settingsStore, searchResult, searchResultDate, false);
    const hasChildren = children.length > 0;
    useEffect(() => {
      if (!hasChildren) {
        tree.setPathExpanded(pathToNodeStr, false);
      }
    }, [tree, hasChildren, pathToNodeStr]);

    const allNodesInPath = pathToNodeSet(path);

    const hasNewChildren =
      children.filter((c) => !allNodesInPath.has(c.relation.from === object ? c.relation.to.id : c.relation.from.id))
        .length > 0;

    // const isSelected = renderController.selectedNodes.has(bullet);
    const isSelected = false;
    const isBackwards = relation.from.id === object.id;
    const isChild = relation.relationType.id === defaultRelationTypes.child.id && !isBackwards;
    const objectCount = countOccurrencesInPath(object, pathObjects);

    useEffect(() => {
      if (
        searchResult &&
        searchResult.get(object.id)?.expandChildren &&
        objectCount === 1 &&
        relation.to.id === object.id
      ) {
        setSearchExpansion(true);
      }
    }, [graphStore, object.id, objectCount, pathToNodeStr, relation.to.id, searchResult]);
    const showChildren = searchResult ? searchExpansion : isExpanded;
    const curView = useCurView();
    const router = useRouter();

    const handleBulletClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.shiftKey) {
          viewStore.openSidebarOutlineView(path);
        } else {
          switch (curView) {
            case ViewType.OUTLINE:
              router.push(`/outline${relationsToURLPath(path, graphStore)}`);
              break;
            case ViewType.THOUGHTSTREAM:
              router.push(`/stream${relationsToURLPath(path, graphStore)}`);
              break;
            case ViewType.SPLIT:
              tree.setRoot(path);
              break;
            default:
              curView satisfies never;
          }
        }
      },
      [tree, curView, router, path, graphStore, viewStore],
    );

    const showRelationType = !isChild || updatingRelationType;
    const relationTypeTextWidth = showRelationType
      ? `${getTextWidth(`${relation.relationType.label}:`, "normal 17.5px ui-sans-serif text-red-500") + 3}px`
      : "0px";
    const [relationComboboxIsOpen, setRelationComboboxIsOpen] = useState(false);

    return (
      <>
        <div id={pathToNodeStr} className={cn(styles.RelatedObjectContainer, isSelected && styles.Selected)}>
          <ViewTypeProvider value={{ viewType, setViewType }}>
            <RelationAtPathProvider
              value={{
                pathToParentRelations,
                pathToParentWithOrderedObjects: pathObjects.slice(0, pathObjects.length - 1),
                pathToNodeStr,
                object,
                parent,
                relation,
                siblingAbove,
                siblingBelow,
                isChild,
                openRelationTypeMenu: () => setRelationComboboxIsOpen(true),
              }}
            >
              <div
                className={cn(
                  styles.RelatedObjectContent,
                  !object.isPrivate &&
                    settingsStore.hideThoughtstreamBullets &&
                    parent === graphStore.thoughtstreamRoot &&
                    styles.RelatedObjectContentPublic,
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <div className={styles.RelatedObjectLeftArea} />
                {/* toggle, bullet, menu */}
                <div className={styles.RelatedObjectLeftHandler}>
                  <div className={styles.RelatedObjectActions}>
                    {hasChildren && (objectCount === 1 || !settingsStore.disableCycles) && isHovered && (
                      <Toggle
                        pathToNodeStr={pathToNodeStr}
                        isSearching={!!searchResult}
                        searchExpansion={searchExpansion}
                        setSearchExpansion={setSearchExpansion}
                      />
                    )}
                    <RelatedObjectMenu setUpdatingRelationType={setUpdatingRelationType} isHovered={isHovered} />
                  </div>

                  {parent.isRelationPinned(relation) && graphStore.correspondingPinnedForObjects.has(relation.id) && (
                    <button className={styles.PinIcon} onClick={() => parent.unpinChildRelation(relation)}>
                      <PinCustom />
                    </button>
                  )}

                  {!object.isPrivate &&
                    settingsStore.hideThoughtstreamBullets &&
                    parent === graphStore.thoughtstreamRoot && (
                      <div className={styles.RelatedObjectPublic}>
                        <GlobeIcon size={12} strokeWidth={2} />
                      </div>
                    )}
                </div>

                <div
                  className={cn(
                    styles.RelatedObjectBulletContainer,
                    settingsStore.hideThoughtstreamBullets && parent === graphStore.thoughtstreamRoot && styles.Hidden,
                  )}
                >
                  {hasChildren &&
                    !showChildren &&
                    (objectCount === 1 || !settingsStore.disableCycles) &&
                    (!settingsStore.hideBulletBackgroundIfParentsOnly || hasNewChildren) && (
                      <Dot
                        height={16}
                        strokeWidth={17}
                        className={cn(styles.Dot, {
                          [styles.DotOutsidePublic]: !object.isPrivate,
                          [styles.DotOutsidePrivate]: object.isPrivate,
                        })}
                      />
                    )}
                  {objectCount === 1 ? (
                    <Dot
                      strokeWidth={5}
                      height={16}
                      className={cn(styles.Dot, {
                        [styles.DotInsidePublic]: !object.isPrivate,
                        [styles.DotInsidePrivate]: object.isPrivate,
                      })}
                      onClick={handleBulletClick}
                    />
                  ) : objectCount > 1 ? (
                    <Circle
                      strokeWidth={6}
                      height={8}
                      className={cn(styles.Circle, { [styles.CirclePrivate]: object.isPrivate })}
                      onClick={handleBulletClick}
                    />
                  ) : null}
                </div>
                {/* relation and node */}
                <div className={styles.RelatedObjectNode}>
                  <div className={styles.RelatedObjectNodeContent}>
                    <HoverCard.Root>
                      {showRelationType && (
                        <HoverCard.Trigger>
                          <RelationCombobox
                            setUpdatingRelationType={setUpdatingRelationType}
                            object={object}
                            parent={parent}
                            relation={relation}
                            isOpen={relationComboboxIsOpen}
                            setIsOpen={setRelationComboboxIsOpen}
                          />
                        </HoverCard.Trigger>
                      )}
                      <HoverCard.Portal>
                        <HoverCard.Content align={"start"} className={styles.RelationHoverCard}>
                          {relation.connectedObjects().length > 0 ? (
                            <>
                              <div>Connected objects:</div>
                              {relation.connectedObjects().map((o) => (
                                <div key={o.id}>{o.text}</div>
                              ))}
                            </>
                          ) : (
                            <div>No connected objects</div>
                          )}
                        </HoverCard.Content>
                      </HoverCard.Portal>
                    </HoverCard.Root>
                    <HoverCard.Root>
                      <HoverCard.Trigger>
                        {viewType === "replace" ? (
                          <ReplaceRelatedNodeView
                            object={object}
                            relation={relation}
                            pathToParentRelations={pathToParentRelations}
                          />
                        ) : (
                          <RelatedObjectEditor indentationWidth={relationTypeTextWidth} object={object} />
                        )}
                      </HoverCard.Trigger>
                      {object instanceof GraphRelation && (
                        <HoverCard.Portal>
                          <HoverCard.Content align={"start"} className={styles.RelationHoverCard}>
                            <div>
                              from:{" "}
                              <span
                                onClick={() => {
                                  router.push(`/outline${relationsToURLPath([object], graphStore)}`);
                                }}
                              >
                                {object.from.text}
                              </span>
                            </div>
                            <div>
                              to: <span>{object.to.text}</span>
                            </div>
                          </HoverCard.Content>
                        </HoverCard.Portal>
                      )}
                    </HoverCard.Root>
                  </div>
                  {settingsStore.showNodeDetails && viewType !== "replace" && (
                    <RelatedObjectDetails position={position} object={object} relation={relation} />
                  )}
                </div>
                {object.relations.length > 1 && (
                  <div className={styles.RelationCounter}>{object.relations.length - 1}</div>
                )}
              </div>
            </RelationAtPathProvider>
          </ViewTypeProvider>
          {showChildren && (
            <RelatedObjectChildren
              pathToParentRelations={[...pathToParentRelations, relation]}
              searchResult={searchResult}
              searchResultDate={searchResultDate}
            />
          )}
        </div>
      </>
    );
  },
);
