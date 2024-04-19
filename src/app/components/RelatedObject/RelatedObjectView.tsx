import { Dot, Ellipsis } from "lucide-react";
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
    searchResult?: Map<string, boolean>;
  }) => {
    const viewController = useViewController();
    const graphStore = useGraphStore();
    // TODO: this was really shoehorned in here for demo day and should be refactored
    const [updatingRelationType, setUpdatingRelationType] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // computed values
    const pathToParentRelations = path.slice(0, path.length - 1);
    const pathToNodeStr = relationsToPathStr(path);
    const pathObjects = relationsPathToParentChild(path);
    const { parent, child: object } = pathObjects[pathObjects.length - 1];

    // children state
    const isExpanded = graphStore.isPathExpanded(pathToNodeStr);
    const hasChildren = getFilteredChildrenAtPath(pathObjects, viewController, searchResult, false).length > 0;

    // const isSelected = viewController.selectedNodes.has(bullet);
    const isSelected = false;
    const relation = path[path.length - 1];
    const isChild = relation.relationType.id === defaultRelationTypes.child.id && relation.to.id === object.id;
    const displayChildren = isExpanded || !!searchResult;

    return (
      <>
        <div className={cn("flex flex-col align-start", isSelected ? "bg-sky-200" : "")}>
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
              setReplacing,
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
              <div className="w-6 relative h-4">
                {hasChildren && !displayChildren && (
                  <Dot stroke="#ddd" height={16} strokeWidth={17} className={cn("cursor-pointer absolute top-0")} />
                )}
                <Dot
                  strokeWidth={5}
                  color="#596567"
                  height={16}
                  className={cn("cursor-pointer absolute top-0")}
                  onClick={() => viewController.setCurrentOutlineViewRoot([...pathToParentRelations, relation])}
                />
              </div>
              {/* relation and node */}
              <div className="flex flex-col flex-1">
                <div className="flex w-full gap-2 items-center">
                  {!isChild || updatingRelationType ? (
                    <RelationCombobox setUpdatingRelationType={setUpdatingRelationType} />
                  ) : null}
                  {!replacing ? <RelatedObjectEditor /> : <ReplaceRelatedNodeView />}
                </div>
                {viewController.showNodeDetails && !replacing && <RelatedObjectDetails />}
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
    const { object, parent, relation, setReplacing, pathToParentRelations, siblingAbove } = useRelationAtPath();

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
          <DropdownMenuItem onSelect={() => setReplacing(true)}>Replace related node</DropdownMenuItem>
          {parent.isRelationPinned(relation) ? (
            <DropdownMenuItem onSelect={() => parent.unpinChildRelation(relation)}>Unpin</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => parent.pinChildRelation(relation)}>Pin</DropdownMenuItem>
          )}
          {/* make bundle */}
          {object instanceof GraphNode &&
            (object.isBundle ? (
              <DropdownMenuItem onSelect={() => object.setIsBundle(false)}>Unbundle</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => object.setIsBundle(true)}>Bundle</DropdownMenuItem>
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
      {object instanceof GraphNode && object.isBundle && <span style={{ color: "gray" }}>BUNDLE</span>}
      {bundles && <span style={{ color: "gray" }}>part of bundle: {bundles.map((b) => b.id).join(", ")}</span>}
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
  const { object: currentObject, setReplacing, relation, pathToParentRelations } = useRelationAtPath();
  const { optionsFlat: options, optionsGrouped } = useMemo(() => {
    const nodeOptions = graph.nodes.filter(
      (node) => node.id !== currentObject.id && node.text.toLowerCase().includes(filter.toLowerCase()),
    );
    const relationOptions = graph.relations.filter(
      (r) =>
        r.id !== currentObject.id && r.id !== relation.id && r.text.toLocaleLowerCase().includes(filter.toLowerCase()),
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
      setReplacing(false);
    },
    [graph, relation, pathToParentRelations, setReplacing],
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
        setReplacing(false);
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
  }, [setReplacing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setReplacing(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selected !== null) {
          onSelect(options[selected]);
        } else {
          setReplacing(false);
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
  }, [setReplacing, onSelect, selected, options]);

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
