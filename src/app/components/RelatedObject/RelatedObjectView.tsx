import { Circle, Dot, Ellipsis } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useViewController } from "../../controller/useViewController";
import { Editor } from "../../editor/Editor";
import { useGraphStore } from "../../store/useGraphStore";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { GraphNode } from "@/app/model/GraphNode";
import { GraphObject } from "@/app/model/GraphObject";
import { GraphRelation } from "@/app/model/GraphRelation";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { SearchResult } from "@/app/store/search";
import { Position, relationsPathToParentChild, relationsToPathStr } from "@/app/util";
import { cn } from "@/lib/utils";
import { action } from "mobx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RelatedObjectChildren, getFilteredChildrenAtPath } from "./RelatedObjectChildren";
import { RelationAtPathProvider, useRelationAtPath } from "./RelatedObjectContext";
import { RelationCombobox } from "./RelationCombobox";

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

    // TODO: this was really shoehorned in here for demo day and should be refactored
    const [updatingRelationType, setUpdatingRelationType] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [viewType, setViewType] = useState<"edit" | "replace" | "search-or-create">(
      relation.relationType.id === defaultRelationTypes.child.id ? "edit" : "search-or-create",
    );

    // children state
    const isExpanded = graphStore.isPathExpanded(pathToNodeStr);
    const hasChildren = getFilteredChildrenAtPath(pathObjects, viewController, searchResult, false).length > 0;

    // const isSelected = viewController.selectedNodes.has(bullet);
    const isSelected = false;
    const isChild = relation.relationType.id === defaultRelationTypes.child.id && relation.to.id === object.id;
    const objectCount = pathObjects.reduce((acc, { child }) => (child.id === object.id ? acc + 1 : acc), 0);

    const displayChildren =
      (!searchResult && isExpanded) ||
      (searchResult &&
        searchResult.get(object.id)?.expandChildren &&
        objectCount === 1 &&
        relation.to.id === object.id);

    // When the relation type changes from child to something else, switch to search-or-create view
    const lastRelationTypeId = useRef(relation.relationType.id);
    useEffect(() => {
      if (lastRelationTypeId.current === "child" && relation.relationType.id !== "child") {
        setViewType("search-or-create");
        lastRelationTypeId.current = relation.relationType.id;
      }
    }, [relation.relationType.id]);

    return (
      <>
        <div id={pathToNodeStr} className={cn("flex flex-col align-start", isSelected ? "bg-sky-200" : "")}>
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
            }}
          >
            <div
              className="flex items-center gap-1 my-1 relative"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* toggle, bullet, menu */}
              <div className="flex items-center gap-1 absolute right-full">
                <RelatedObjectMenu setUpdatingRelationType={setUpdatingRelationType} isHovered={isHovered} />
                {hasChildren && isHovered && <Toggle />}
              </div>
              <div className="w-4 relative right-2 h-4">
                {hasChildren && !displayChildren && (
                  <Dot stroke="#ddd" height={16} strokeWidth={17} className={cn("cursor-pointer absolute top-0")} />
                )}
                {isChild && (
                  <Dot
                    strokeWidth={5}
                    color="#596567"
                    height={16}
                    className={cn("cursor-pointer absolute top-0")}
                    onClick={() => viewController.setCurrentOutlineViewRoot([...pathToParentRelations, relation])}
                  />
                )}
                {!isChild && (
                  <Circle
                    strokeWidth={6}
                    color="#596567"
                    height={8}
                    className={cn("cursor-pointer absolute top-1")}
                    onClick={() => viewController.setCurrentOutlineViewRoot([...pathToParentRelations, relation])}
                  />
                )}
              </div>
              {/* relation and node */}
              <div className="flex flex-col flex-1">
                <div className="flex w-full gap-2 items-center">
                  {!isChild || updatingRelationType ? (
                    <RelationCombobox setUpdatingRelationType={setUpdatingRelationType} />
                  ) : null}
                  {viewType === "edit" ? (
                    <RelatedObjectEditor />
                  ) : viewType === "replace" ? (
                    <ReplaceRelatedNodeView />
                  ) : (
                    <SearchOrCreateNodeView />
                  )}
                </div>
                {viewController.showNodeDetails && viewType !== "replace" && <RelatedObjectDetails />}
              </div>
            </div>
          </RelationAtPathProvider>
          {displayChildren && (
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
        <DropdownMenuTrigger>
          <Ellipsis size={18} className={cn(isHovered ? "text-grey-400" : "text-transparent")} />
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
          <DropdownMenuItem onSelect={() => setViewType("replace")}>Replace related node</DropdownMenuItem>
          {viewType !== "search-or-create" && (
            <DropdownMenuItem
              onSelect={() => {
                setViewType("search-or-create");
              }}
            >
              Set to search or create view
            </DropdownMenuItem>
          )}
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

const RelatedObjectEditor = observer(() => {
  const { object } = useRelationAtPath();
  const graphStore = useGraphStore();
  const hasNonChildRelation = graphStore
    .getRelationList(object)
    .values()
    .some(({ item: relation }) => relation.relationType.id !== "child");
  return (
    <div
      style={{
        gap: "5px",
        display: "flex",
        alignItems: "flex-start",
        flex: 1,
        color: hasNonChildRelation ? "#2f3a90" : undefined,
        textDecoration: hasNonChildRelation ? "underline" : undefined,
      }}
    >
      {/* <div className={cn("flex flex-col flex-1", bullet.type === "bundle" && "text-xl")}> */}
      <div className="flex flex-col flex-1">
        {object instanceof GraphNode ? <Editor /> : <span className="italic">{object.text}</span>}
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

const Toggle = observer(() => {
  const { pathToNodeStr } = useRelationAtPath();
  const graphStore = useGraphStore();
  const isExpanded = graphStore.isPathExpanded(pathToNodeStr);
  return (
    <button
      style={{
        backgroundColor: "transparent",
        border: "none",
        width: "1rem",
        fontSize: "0.6rem",
        color: "#9ca3af",
        cursor: "pointer",
        userSelect: "none",
      }}
      className="relative right-1"
      onClick={() => graphStore.togglePathExpanded(pathToNodeStr)}
    >
      {isExpanded ? "▼" : "▶"}
    </button>
  );
});

function ReplaceRelatedNodeView() {
  const graph = useGraphStore();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
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
    <div className="ml-4 flex-1">
      <div ref={ref} className="relative flex flex-col z-10">
        <input
          placeholder="Search nodes..."
          autoFocus
          className="h-8"
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="absolute top-8 left-0 w-full bg-white border border-gray-300">
          {optionsGrouped.map((group) => (
            <div key={group.type}>
              <div className="underline">{group.type}</div>
              {group.options.map(({ index, object, text }) => (
                <div
                  key={object.id}
                  onClick={() => onSelect(object)}
                  onMouseEnter={() => setSelected(index)}
                  className={selected === index ? "bg-gray-200" : ""}
                >
                  {text}
                </div>
              ))}
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
        className="border border-blue-500 rounded"
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
        <div className="absolute top-6 left-0 w-full bg-white border border-gray-300 z-10">
          {nodesMatchingSearch.map((node, i) => (
            <div
              key={node.id}
              onClick={() => {
                onSelect(node);
              }}
              onMouseEnter={() => setSelected(i)}
              className={selected === i ? "bg-gray-200" : ""}
            >
              {node.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
