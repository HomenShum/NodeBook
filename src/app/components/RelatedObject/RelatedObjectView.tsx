import { PinCustom } from "@/app/components/icons";
import { ViewType } from "@/app/controller/ViewController";
import { useViewController } from "@/app/controller/useViewController";
import { GraphNode } from "@/app/model/GraphNode";
import { GraphRelation } from "@/app/model/GraphRelation";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { SearchResult } from "@/app/model/search";
import { useGraphStore } from "@/app/model/useGraphStore";
import { useSettingsStore } from "@/app/model/useSettingsStore";
import {
  Position,
  countOccurrencesInPath,
  pathToNodeSet,
  relationsPathToParentChild,
  relationsToPathStr,
  relationsToURLPath,
  useCurView,
} from "@/app/util";
import { cn } from "@/lib/utils";
import * as HoverCard from "@radix-ui/react-hover-card";
import { Circle, Dot, GlobeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../OutlineView.module.css";
import { RelatedObjectChildren } from "./RelatedObjectChildren";
import { RelationAtPathProvider, useRelationAtPath } from "./RelatedObjectContext";
import { RelatedObjectDetails } from "./RelatedObjectDetails";
import { RelatedObjectEditor } from "./RelatedObjectEditor";
import { RelatedObjectMenu } from "./RelatedObjectMenu";
import { RelationCombobox } from "./RelationCombobox";
import { ReplaceRelatedNodeView } from "./ReplaceRelatedNodeView";
import Toggle from "./Toggle";
import { getFilteredChildrenAtPath } from "./getFilteredChildrenAtPath";

/**
 * The view type of the related object. This determines what is displayed in the
 * related object view.
 * - `edit`: The default view where edits update the object content (or create a
 *   new object when it's rendered as a link)
 * - `replace`: The view where the user can replace the object with another
 *   object.
 * - `temp-edit`: When an object is rendered as a link, you can drop into a
 *   temporary edit mode to edit the object content
 * TODO: this should be refactored
 */
export type RelatedObjectViewType = "edit" | "replace" | "temp-edit";

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
    const viewController = useViewController();
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
    const isExpanded = graphStore.isPathExpanded(pathToNodeStr);
    const [searchExpansion, setSearchExpansion] = useState(false);
    const children = getFilteredChildrenAtPath(pathObjects, settingsStore, searchResult, searchResultDate, false);
    const hasChildren = children.length > 0;
    useEffect(() => {
      if (!hasChildren) {
        graphStore.setPathExpanded(pathToNodeStr, false);
      }
    }, [graphStore, hasChildren, pathToNodeStr]);

    const allNodesInPath = pathToNodeSet(path);

    const hasNewChildren =
      children.filter((c) => !allNodesInPath.has(c.relation.from === object ? c.relation.to.id : c.relation.from.id))
        .length > 0;

    // const isSelected = viewController.selectedNodes.has(bullet);
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

    const setPathToThisAsRoot = useCallback(() => {
      if (viewRoot.id === graphStore.thoughtstreamRoot.id) {
        if (curView === ViewType.THOUGHTSTREAM) {
          router.push(`/stream${relationsToURLPath([...pathToParentRelations, relation], graphStore)}`);
        } else if (curView === ViewType.SPLIT) {
          router.push(
            `/split/outline${relationsToURLPath(
              viewController.currentOutlineViewRoot!,
              graphStore,
            )}/stream${relationsToURLPath([...pathToParentRelations, relation], graphStore)}`,
          );
        }
      } else if (viewRoot.id === graphStore.outlineRoot.id) {
        if (curView === ViewType.OUTLINE) {
          router.push(`/outline${relationsToURLPath([...pathToParentRelations, relation], graphStore)}`);
        } else if (curView === ViewType.SPLIT) {
          router.push(
            `/split/outline${relationsToURLPath(
              [...pathToParentRelations, relation],
              graphStore,
            )}/stream${relationsToURLPath(viewController.currentStreamViewRoot!, graphStore)}`,
          );
        }
      } else {
        throw new Error("Unknown view root");
      }
    }, [
      viewRoot.id,
      graphStore.thoughtstreamRoot.id,
      graphStore.outlineRoot.id,
      curView,
      router,
      pathToParentRelations,
      relation,
      viewController,
    ]);

    const showRelationType = !isChild || updatingRelationType;
    const relationTypeTextWidth = showRelationType
      ? `${getTextWidth(`${relation.relationType.label}:`, "normal 17.5px ui-sans-serif") + 3}px`
      : "0px";

    return (
      <>
        <div id={pathToNodeStr} className={cn(styles.OutlineObject, isSelected && styles.Selected)}>
          <RelationAtPathProvider
            value={{
              pathToParentRelations,
              pathToParentWithOrderedObjects: pathObjects.slice(0, pathObjects.length - 1),
              pathToNodeStr,
              object,
              parent,
              position,
              relation,
              siblingAbove,
              siblingBelow,
              viewType,
              setViewType,
              isBackwards,
              isChild,
            }}
          >
            <div
              className={cn(
                styles.OutlineObjectContent,
                !object.isPrivate &&
                  settingsStore.hideThoughtstreamBullets &&
                  parent === graphStore.thoughtstreamRoot &&
                  styles.OutlineObjectContentPublic,
              )}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className={styles.OutlineObjectLeftArea} />
              {/* toggle, bullet, menu */}
              <div className="flex items-center gap-1 absolute right-full">
                <div className="flex items-center gap-1">
                  {hasChildren && (objectCount === 1 || !settingsStore.disableCycles) && isHovered && (
                    <Toggle
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
                    <div className="relative right-[6px] pl-1  translate-y-[0.5px] flex text-[--teal-7] bg-white">
                      <GlobeIcon size={12} strokeWidth={2} />
                    </div>
                  )}
              </div>

              <div
                className={cn(
                  "w-4 relative right-2 h-4 flex",
                  settingsStore.hideThoughtstreamBullets && parent === graphStore.thoughtstreamRoot && "hidden",
                )}
              >
                {hasChildren &&
                  !showChildren &&
                  (objectCount === 1 || !settingsStore.disableCycles) &&
                  (!settingsStore.hideBulletBackgroundIfParentsOnly || hasNewChildren) && (
                    <Dot
                      stroke={!object.isPrivate ? "var(--teal-4)" : "var(--gray-4)"}
                      height={16}
                      strokeWidth={17}
                      className={cn("cursor-pointer absolute top-0 left-0")}
                    />
                  )}
                {objectCount === 1 ? (
                  <Dot
                    strokeWidth={5}
                    color={!object.isPrivate ? "var(--teal-10)" : "var(--gray-10)"}
                    height={16}
                    className={cn("cursor-pointer absolute top-0")}
                    onClick={setPathToThisAsRoot}
                  />
                ) : objectCount > 1 ? (
                  <Circle
                    strokeWidth={6}
                    color={!object.isPrivate ? "var(--teal-10)" : "var(--gray-10)"}
                    height={8}
                    className={cn("cursor-pointer absolute top-1")}
                    onClick={setPathToThisAsRoot}
                  />
                ) : null}
              </div>
              {/* relation and node */}
              <div className="flex flex-col flex-1 relative -top-[2px]">
                <div className="flex flex-row flex-wrap w-full gap-1 items-baseline pb-2">
                  <HoverCard.Root>
                    {showRelationType && (
                      <HoverCard.Trigger className="z-10">
                        <RelationCombobox setUpdatingRelationType={setUpdatingRelationType} />
                      </HoverCard.Trigger>
                    )}
                    <HoverCard.Portal>
                      <HoverCard.Content
                        align={"start"}
                        className="bg-white border-gray-300 border p-2 rounded-md shadow z-50"
                      >
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
                        <ReplaceRelatedNodeView />
                      ) : (
                        <RelatedObjectEditor isHovered={isHovered} indentationWidth={relationTypeTextWidth} />
                      )}
                    </HoverCard.Trigger>
                    {object instanceof GraphRelation && (
                      <HoverCard.Portal>
                        <HoverCard.Content
                          align={"start"}
                          className="bg-white border-gray-300 border p-2 rounded-md shadow z-50"
                        >
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
                {settingsStore.showNodeDetails && viewType !== "replace" && <RelatedObjectDetails />}
              </div>
              {object.relations.length > 1 && (
                <div className="relative h-6 bg-[--gray-1] text-[--gray-8] px-1">{object.relations.length - 1}</div>
              )}
            </div>
          </RelationAtPathProvider>
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

const SearchOrCreateNodeView = observer(() => {
  const graph = useGraphStore();
  const view = useViewController();
  const { object, relation, parent, pathToParentRelations } = useRelationAtPath();
  const [search, setSearch] = useState(object.text);
  const [selected, setSelected] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const [inputFocused, setInputFocused] = useState(false);

  // Keep the search input in sync with the object's text
  useEffect(() => setSearch(object.text), [object.text]);

  // Replace the current object with the selected node
  const onSelect = useCallback(
    (node: GraphNode) => {
      graph.setGraphNodeAtPath([...pathToParentRelations, relation], node);
      setSearch(node.text);
      view.setFocusedNode(relationsToPathStr([...pathToParentRelations, relation]));
    },
    [graph, relation, pathToParentRelations, view],
  );

  // Filter nodes that match the search
  const nodesMatchingSearch = useMemo(() => {
    return graph.nodes.filter((n) => n.id !== object.id && n.text.toLowerCase().includes(search.toLowerCase()));
  }, [graph.nodes, search, object]);

  return (
    <div className="flex flex-col relative">
      <input
        ref={ref}
        className=" text-[--teal-10] hover:bg-[--teal-a2] rounded-sm outline-none underline decoration-[--gray-6]"
        value={search}
        placeholder="Search or create node..."
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            ref.current?.blur();
          }
          if (nodesMatchingSearch.length > 0) {
            if (e.key === "Enter" && selected !== null) {
              e.preventDefault();
              onSelect(nodesMatchingSearch[selected]);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              if (selected === null) {
                setSelected(0);
              } else {
                setSelected((selected + 1) % nodesMatchingSearch.length);
              }
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (selected === null) {
                setSelected(nodesMatchingSearch.length - 1);
              } else {
                setSelected((selected - 1 + nodesMatchingSearch.length) % nodesMatchingSearch.length);
              }
            }
          } else {
            if (e.key === "Enter") {
              e.preventDefault();
              const { relation: newRelation } = graph.createChildNode(parent);
              graph.getRelationList(parent).move([newRelation], relation);
              view.setFocusedNode(relationsToPathStr([...pathToParentRelations, newRelation]));
            }
          }
        }}
        onChange={(e) => {
          const search = e.target.value;
          let newNode = graph.nodes.find((n) => n.text !== "" && n.text === search);
          if (!newNode) {
            newNode = graph.createNode({ content: search });
          }
          graph.setGraphNodeAtPath([...pathToParentRelations, relation], newNode);
          // If the node has no relations, or is only related to the thoughtstream, delete it
          if (
            object.relations.length === 0 ||
            object.relations.every((r) => {
              const other = r.from.id === object.id ? r.to : r.from;
              return other.id === graph.thoughtstreamRoot.id;
            })
          ) {
            graph.deleteNode(object.id);
          }
          setSearch(search);
        }}
      />
      {inputFocused && nodesMatchingSearch.length > 0 && (
        <div className="absolute top-6 left-0 w-full bg-white border border-[--teal-3] text-[--gray-10] rounded-md z-10">
          {nodesMatchingSearch.map((node, i) => (
            <div
              key={node.id}
              onClick={() => {
                onSelect(node);
              }}
              onMouseEnter={() => setSelected(i)}
              className={`px-4 py-2 rounded-sm cursor-pointer ${selected === i ? "bg-[--teal-1]" : ""}`}
            >
              {node.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
