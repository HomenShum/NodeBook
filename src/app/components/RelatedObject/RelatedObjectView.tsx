import { Circle, Dot, Edit2, Ellipsis, GlobeIcon, Play } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useViewController } from "../../controller/useViewController";
import { NodeContentEditor } from "../../editor/NodeContentEditor";
import { useGraphStore } from "../../store/useGraphStore";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { GraphNode } from "@/app/model/GraphNode";
import { GraphRelation } from "@/app/model/GraphRelation";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { SearchResult } from "@/app/store/search";
import { Position, relationsPathToParentChild, relationsToPathStr } from "@/app/util";
import { cn } from "@/lib/utils";
import { action } from "mobx";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../OutlineView.module.css";

import { GraphObject } from "@/app/model/GraphObject";
import { PinCustom } from "../icons/icons";
import { RelatedObjectChildren, getFilteredChildrenAtPath } from "./RelatedObjectChildren";
import { RelationAtPathProvider, useRelationAtPath } from "./RelatedObjectContext";
import { RelationCombobox } from "./RelationCombobox";

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

export const RelatedObjectView = observer(
  ({
    path,
    position,
    siblingAbove,
    siblingBelow,
    searchResult,
  }: {
    path: GraphRelation[];
    position: Position;
    siblingAbove?: GraphRelation;
    siblingBelow?: GraphRelation;
    searchResult?: Map<string, SearchResult>;
  }) => {
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
    const children = getFilteredChildrenAtPath(pathObjects, viewController, searchResult, false);
    const hasChildren = children.length > 0;

    const allNodesInPath = new Set();
    for (const pathRelation of path) {
      allNodesInPath.add(pathRelation.from.id);
      allNodesInPath.add(pathRelation.to.id);
    }

    const hasNewChildren =
      children.filter((c) => !allNodesInPath.has(c.relation.from === object ? c.relation.to.id : c.relation.from.id))
        .length > 0;

    // const isSelected = viewController.selectedNodes.has(bullet);
    const isSelected = false;
    const isBackwards = relation.from.id === object.id;
    const isChild = relation.relationType.id === defaultRelationTypes.child.id && !isBackwards;
    const objectCount = pathObjects.reduce((acc, { child }) => (child.id === object.id ? acc + 1 : acc), 0);

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

    const setPathToThisAsRoot = useCallback(() => {
      if (viewRoot.id === graphStore.thoughtstreamRoot.id) {
        viewController.setCurrentStreamViewRoot([...pathToParentRelations, relation]);
      } else if (viewRoot.id === graphStore.outlineRoot.id) {
        viewController.setCurrentOutlineViewRoot([...pathToParentRelations, relation]);
      } else {
        throw new Error("Unknown view root");
      }
    }, [viewController, viewRoot, graphStore, pathToParentRelations, relation]);

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
                  viewController.hideThoughtstreamBullets &&
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
                  {hasChildren && (objectCount === 1 || !viewController.disableCycles) && isHovered && (
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
                  viewController.hideThoughtstreamBullets &&
                  parent === graphStore.thoughtstreamRoot && (
                    <div className="relative right-[10px] pl-1  translate-y-[0.5px] flex text-[--teal-7] bg-white">
                      <GlobeIcon size={13} strokeWidth={2} />
                    </div>
                  )}
              </div>

              <div
                className={cn(
                  "w-4 relative right-2 h-4 flex",
                  viewController.hideThoughtstreamBullets && parent === graphStore.thoughtstreamRoot && "hidden",
                )}
              >
                {hasChildren &&
                  !showChildren &&
                  (objectCount === 1 || !viewController.disableCycles) &&
                  (!viewController.hideBulletBackgroundIfParentsOnly || hasNewChildren) && (
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
                <div className="flex w-full gap-2 items-baseline pb-2">
                  {!isChild || updatingRelationType ? (
                    <RelationCombobox setUpdatingRelationType={setUpdatingRelationType} />
                  ) : null}
                  {viewType === "replace" ? <ReplaceRelatedNodeView /> : <RelatedObjectEditor isHovered={isHovered} />}
                </div>
                {viewController.showNodeDetails && viewType !== "replace" && <RelatedObjectDetails />}
              </div>
            </div>
          </RelationAtPathProvider>
          {showChildren && (
            <RelatedObjectChildren
              pathToParentRelations={[...pathToParentRelations, relation]}
              searchResult={searchResult}
            />
          )}
        </div>
      </>
    );
  },
);

const RelatedObjectMenu = observer(
  // ({ bullet, setUpdatingRelationType }: { bullet: Bullet; setUpdatingRelationType: (v: boolean) => void }) => {
  ({ setUpdatingRelationType, isHovered }: { setUpdatingRelationType: (v: boolean) => void; isHovered: boolean }) => {
    const viewController = useViewController();
    const graphStore = useGraphStore();
    const { object, parent, relation, pathToParentRelations, siblingAbove, viewType, setViewType } =
      useRelationAtPath();

    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="mx-2">
          <Ellipsis size={18} className={cn(isHovered ? "text-[var(--gray-8)] bg-white" : "text-transparent")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem
            onSelect={action(() => {
              graphStore.deleteRelation(relation);
              if (siblingAbove) {
                const pathStr = relationsToPathStr([...pathToParentRelations, siblingAbove]);
                viewController.setFocusedNode(pathStr);
              }
            })}
          >
            Delete relation
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setViewType("replace")}>Replace related object</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={action(() => {
              object.setIsPrivate(!object.isPrivate);
            })}
          >
            {object.isPrivate ? "Make public" : "Make private"}
          </DropdownMenuItem>
          {viewType !== "edit" && (
            <DropdownMenuItem
              onSelect={() => {
                setViewType("edit");
              }}
            >
              Set to edit view
            </DropdownMenuItem>
          )}
          {parent.isRelationPinned(relation) ? (
            <DropdownMenuItem onSelect={() => parent.unpinChildRelation(relation)}>Unpin</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => parent.pinChildRelation(relation)}>Pin</DropdownMenuItem>
          )}
          {/* toggle bundle */}
          {object instanceof GraphNode &&
            (object.isBundle ? (
              <DropdownMenuItem onSelect={() => object.setIsBundle(false)}>unset as bundle</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => object.setIsBundle(true)}>set as bundle</DropdownMenuItem>
            ))}
          {/* toggle zone */}
          {object instanceof GraphNode &&
            (object.isZone ? (
              <DropdownMenuItem onSelect={() => object.setIsZone(false)}>unset as zone</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => object.setIsZone(true)}>set as zone</DropdownMenuItem>
            ))}
          <DropdownMenuItem onSelect={() => setUpdatingRelationType(true)}>Change relation type</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={action(() => {
              graphStore.createChildNode(object);
              const pathStr = relationsToPathStr([...pathToParentRelations, relation]);
              graphStore.setPathExpanded(pathStr, true);
            })}
          >
            Add child
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

const RelatedObjectEditor = observer(({ isHovered }: { isHovered: boolean }) => {
  const graph = useGraphStore();
  const viewController = useViewController();
  const { object, viewType, setViewType, pathToNodeStr } = useRelationAtPath();
  const ref = useRef<HTMLDivElement>(null);
  const treatAsLink = object instanceof GraphNode && graph.shouldTreatObjectAsLink(object) && viewType !== "temp-edit";

  // close the temp edit view when clicking outside of it
  useEffect(() => {
    if (viewType === "temp-edit") {
      const handleClick = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          setViewType("edit");
        }
      };
      window.addEventListener("click", handleClick);
      return () => {
        window.removeEventListener("click", handleClick);
      };
    }
  }, [object.id, setViewType, viewType, viewController, pathToNodeStr]);

  return (
    <div
      ref={ref}
      style={{
        gap: "5px",
        display: "flex",
        alignItems: "flex-start",
        flex: 1,
        color: treatAsLink ? "#0b0b79" : undefined,
        textDecoration: treatAsLink ? "underline #cecece" : undefined,
        backgroundColor: viewType === "temp-edit" ? "var(--teal-2)" : undefined,
      }}
    >
      <div className="flex flex-col flex-1">
        {object instanceof GraphNode ? (
          <div className="flex ">
            <NodeContentEditor />
            {treatAsLink && isHovered && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewType("temp-edit");
                  viewController.setFocusedNode(pathToNodeStr);
                }}
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
        ) : (
          <span className="italic">{object.text}</span>
        )}
      </div>
    </div>
  );
});

const RelatedObjectDetails = observer(() => {
  const graphStore = useGraphStore();
  const { object, relation, position } = useRelationAtPath();
  const bundles = graphStore.relationToBundles.get(relation.id);

  const parentZones = Array.from(
    new Set(
      relation.relations
        .filter(
          (r) =>
            // is parent relation
            r.relationType.id === defaultRelationTypes.child.id &&
            r.to.id === relation.id &&
            // and parent is a zone
            r.from instanceof GraphNode &&
            r.from.isZone,
        )
        .map((r) => r.from),
    ),
  );

  return (
    <div style={{ display: "flex", fontSize: "0.75rem", gap: "10px" }}>
      {position && (
        <span style={{ color: "gray" }}>
          position: {position.int}-{position.frac}
        </span>
      )}
      <span style={{ color: "gray" }}>id: {object.id}</span>
      <span style={{ color: "gray" }}>relationId: {relation.id}</span>
      <span style={{ color: "gray" }}>createdAt: {object.createdAt.toISOString()}</span>
      {object instanceof GraphNode && object.isBundle && <span style={{ color: "gray" }}>#BUNDLE</span>}
      {object instanceof GraphNode && object.isZone && <span style={{ color: "gray" }}>#ZONE</span>}
      {bundles && <span style={{ color: "gray" }}>part of bundle: {bundles.map((b) => b.id).join(", ")}</span>}
      {parentZones.length > 0 && (
        <span style={{ color: "gray" }}>zones: {parentZones.map((z) => `${z.id}:"${z.text}"`).join(", ")}</span>
      )}
    </div>
  );
});

const Toggle = observer(
  ({
    isSearching,
    searchExpansion,
    setSearchExpansion,
  }: {
    searchExpansion: boolean;
    setSearchExpansion: Dispatch<SetStateAction<boolean>>;
    isSearching: boolean;
  }) => {
    const { pathToNodeStr } = useRelationAtPath();
    const graphStore = useGraphStore();
    const isExpanded = isSearching ? searchExpansion : graphStore.isPathExpanded(pathToNodeStr);
    return (
      <button
        style={{
          backgroundColor: "white",
          border: "none",
          width: "0",
          height: "1rem",
          color: "var(--gray-8)",
          cursor: "pointer",
          userSelect: "none",
        }}
        className="relative right-[4px]"
        onClick={() => {
          if (isSearching) {
            setSearchExpansion(!searchExpansion);
          } else {
            graphStore.togglePathExpanded(pathToNodeStr);
          }
        }}
      >
        {isExpanded ? (
          <Play size={8} fill="currentColor" className="rotate-90" />
        ) : (
          <Play size={8} fill="currentColor" />
        )}
      </button>
    );
  },
);

function ReplaceRelatedNodeView() {
  const graph = useGraphStore();
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { object: currentObject, setViewType, relation, pathToParentRelations } = useRelationAtPath();
  const { optionsFlat: options, optionsGrouped } = useMemo(() => {
    const keywords = filter.split(/\s+/);
    const nodeOptions = graph.nodes.filter(
      (node) =>
        node.id !== currentObject.id &&
        keywords.every((keyword) => node.text.toLowerCase().includes(keyword.toLowerCase())),
    );
    const relationOptions = graph.relations.filter(
      (r) =>
        r.id !== currentObject.id &&
        r.id !== relation.id &&
        keywords.every((keyword) => r.text.toLowerCase().includes(keyword.toLowerCase())),
    );
    const optionsGrouped: {
      type: "nodes" | "relations";
      options: { index: number; object: GraphObject; text: string }[];
    }[] = [];
    let index = 0;
    if (nodeOptions.length > 0) {
      optionsGrouped.push({
        type: "nodes",
        options: nodeOptions.map((node) => ({ index: index++, object: node, text: node.text })),
      });
    }
    if (relationOptions.length > 0) {
      optionsGrouped.push({
        type: "relations",
        options: relationOptions.map((relation) => ({ index: index++, object: relation, text: relation.text })),
      });
    }
    return {
      optionsFlat: [...nodeOptions, ...relationOptions],
      optionsGrouped,
    };
  }, [graph, currentObject, relation, filter]);
  const [selected, setSelected] = useState<number | null>(optionsGrouped.length === 0 ? null : 0);

  const onSelect = useCallback(
    (obj: GraphObject) => {
      graph.setGraphNodeAtPath([...pathToParentRelations, relation], obj);
      setViewType("edit");
    },
    [graph, relation, pathToParentRelations, setViewType],
  );

  // TODO hack
  useEffect(() => {
    setTimeout(() => {
      ref.current?.querySelector("input")?.focus();
    }, 0);
  }, []);

  // TODO hack
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setViewType("edit");
      }
    };
    // for some reason, when I click "replace" which renders this component, that click
    // was picked up here and immediately closed the dropdown.
    setTimeout(() => {
      window.addEventListener("click", handleClick);
    }, 0);
    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, [setViewType]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewType("edit");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selected !== null) {
          onSelect(options[selected]);
        } else {
          setViewType("edit");
        }
      } else if (e.key === "ArrowDown") {
        if (selected === null) {
          setSelected(0);
        } else {
          setSelected((selected + 1) % options.length);
        }
      } else if (e.key === "ArrowUp") {
        if (selected === null) {
          setSelected(options.length - 1);
        } else {
          setSelected((selected - 1 + options.length) % options.length);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setViewType, onSelect, selected, options]);

  return (
    <div className="ml-0 flex-1">
      <div ref={ref} className="relative flex flex-col z-10">
        <input
          placeholder="Search nodes..."
          autoFocus
          className="px-2 h-8 outline-none bg-[--teal-a2] rounded text-[--teal-a9]"
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="absolute top-8 p-1 left-0 w-full bg-[white] border border-[--teal-3] rounded-sm flex flex-col gap-4">
          {optionsGrouped.map((group) => (
            <div key={group.type}>
              <div className="px-2 py-0 uppercase text-sm text-[--gray-6] pointer-events-none">{group.type}</div>
              {group.options.map(
                ({ index, object, text }) =>
                  text && ( // avoiding empty nodes being rendered into the search results
                    <div
                      key={object.id}
                      onClick={() => onSelect(object)}
                      onMouseEnter={() => setSelected(index)}
                      className={`px-2 py-1 rounded ${selected === index ? "bg-[--teal-2]" : ""} `}
                    >
                      {text}
                    </div>
                  ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
