import { Dot, Ellipsis } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Editor } from "../../editor/Editor";
import { useGraphStore } from "../../store/useGraphStore";
import { useViewStore } from "../../store/useViewStore";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { GraphNode } from "@/app/model/GraphNode";
import { GraphRelation } from "@/app/model/GraphRelation";
import { defaultRelationTypes } from "@/app/model/GraphStore";
import { ViewStore } from "@/app/model/ViewStore";
import { relationsToNodes, relationsToPathStr } from "@/app/util";
import { cn } from "@/lib/utils";
import { action } from "mobx";
import { useCallback, useEffect, useRef, useState } from "react";
import { RelatedNodeChildren } from "./RelatedNodeChildren";
import { RelationAtPathProvider, useRelationAtPath } from "./RelatedNodeContext";
import { RelationCombobox } from "./RelationCombobox";

export const RelatedNodeView = observer(
  // ({ bullet, position, depth = 0, parents = [], siblingAbove, siblingBelow }: Props) => {
  ({
    pathToParentRelations,
    relation,
    siblingAbove,
    siblingBelow,
  }: {
    pathToParentRelations: GraphRelation[];
    relation: GraphRelation;
    siblingAbove?: GraphRelation;
    siblingBelow?: GraphRelation;
  }) => {
    const viewStore = useViewStore();
    const graphStore = useGraphStore();
    // TODO: this was really shoehorned in here for demo day and should be refactored
    const [updatingRelationType, setUpdatingRelationType] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // computed values
    const pathToParentNodes = relationsToNodes(pathToParentRelations);
    const pathToNodeStr = relationsToPathStr([...pathToParentRelations, relation]);
    const parent = pathToParentNodes[pathToParentNodes.length - 1];
    const node = relation.from.id === parent.id ? relation.to : relation.from;

    // children state
    const isExpanded = graphStore.isPathExpanded(pathToNodeStr);
    const childRelations = node.relations.filter((relationWithChild) => {
      const childNode = relationWithChild.from.id === node.id ? relationWithChild.to : relationWithChild.from;
      return filterFocusedNodesRelations(viewStore, relationWithChild, childNode, parent);
    });
    const hasChildren = childRelations.length > 0;

    // const isSelected = viewStore.selectedNodes.has(bullet);
    const isSelected = false;
    const isChild = relation.type.id === defaultRelationTypes.child.id && relation.to.id === node.id;

    return (
      <>
        <div className={cn("flex flex-col align-start", isSelected ? "bg-sky-200" : "")}>
          <RelationAtPathProvider
            value={{
              pathToParentRelations,
              pathToParentNodes,
              pathToNodeStr,
              node,
              parent,
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
                <RelatedNodeMenu setUpdatingRelationType={setUpdatingRelationType} isHovered={isHovered} />
                {hasChildren && isHovered && <Toggle />}
              </div>
              <div className="w-6 relative h-4">
                {hasChildren && !isExpanded && (
                  <Dot stroke="#ddd" height={16} strokeWidth={17} className={cn("cursor-pointer absolute top-0")} />
                )}
                <Dot
                  strokeWidth={5}
                  color="#596567"
                  height={16}
                  className={cn("cursor-pointer absolute top-0")}
                  onClick={() => viewStore.setCurrentOutlineViewRoot([...pathToParentRelations, relation])}
                />
              </div>
              {/* relation and node */}
              <div className="flex flex-col flex-1 items-baseline">
                <div className="flex w-full gap-2">
                  {!isChild || updatingRelationType ? (
                    <RelationCombobox setUpdatingRelationType={setUpdatingRelationType} />
                  ) : null}
                  {!replacing ? <RelatedNodeEditor /> : <ReplaceRelatedNodeView />}
                </div>
                {viewStore.showNodeDetails && !replacing && <RelatedNodeDetails />}
              </div>
            </div>
          </RelationAtPathProvider>
          {isExpanded && <RelatedNodeChildren pathToParentRelations={[...pathToParentRelations, relation]} />}
        </div>
      </>
    );
  },
);

const RelatedNodeMenu = observer(
  // ({ bullet, setUpdatingRelationType }: { bullet: Bullet; setUpdatingRelationType: (v: boolean) => void }) => {
  ({ setUpdatingRelationType, isHovered }: { setUpdatingRelationType: (v: boolean) => void; isHovered: boolean }) => {
    const viewStore = useViewStore();
    const graphStore = useGraphStore();
    const { node, parent, relation, setReplacing, pathToParentRelations, siblingAbove } = useRelationAtPath();

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
                viewStore.setFocusedNode(pathStr);
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
          {node.type === "bullet" ? (
            <DropdownMenuItem onSelect={() => node.setType("bundle")}>Convert to bundle</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => node.setType("bullet")}>Convert to bullet</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setUpdatingRelationType(true)}>Change relation type</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={action(() => {
              node.createChild();
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

const RelatedNodeEditor = observer(() => {
  const { node } = useRelationAtPath();
  const hasNonChildRelation = node.relations.some(relation => relation.type.id !== "child");
  return (
    <div
      style={{
        gap: "5px",
        display: "flex",
        alignItems: "flex-start",
        flex: 1,
        color: hasNonChildRelation ? "#2f3a90" : undefined,
        textDecoration: hasNonChildRelation ? "underline" : undefined
      }}
    >
      {/* <div className={cn("flex flex-col flex-1", bullet.type === "bundle" && "text-xl")}> */}
      <div className="flex flex-col flex-1">
        <Editor />
      </div>
    </div>
  );
});

const RelatedNodeDetails = observer(() => {
  const graphStore = useGraphStore();
  const { node, relation, parent } = useRelationAtPath();
  const position = graphStore.relationsByNodeId.get(parent.id)?.get(node.id)?.position;
  return (
    <div style={{ display: "flex", fontSize: "0.75rem", gap: "10px" }}>
      {position && (
        <span style={{ color: "gray" }}>
          position: {position.int}-{position.frac}
        </span>
      )}
      <span style={{ color: "gray" }}>nodeId: {node.id}</span>
      <span style={{ color: "gray" }}>relationId: {relation.id}</span>
      <span style={{ color: "gray" }}>createdAt: {node.createdAt.toISOString()}</span>
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
  const { node: currentNode, setReplacing, relation, pathToParentRelations } = useRelationAtPath();
  const options = graph.nodes.filter(
    (node) => node.id !== currentNode.id && node.text.toLowerCase().includes(filter.toLowerCase()),
  );
  const onSelect = useCallback(
    (node: GraphNode) => {
      graph.setGraphNodeAtPath(relation, node, pathToParentRelations);
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
          {options.map((node, i) => (
            <div
              key={node.id}
              onClick={() => onSelect(node)}
              onMouseEnter={() => setSelected(i)}
              className={selected === i ? "bg-gray-200" : ""}
            >
              {node.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
export function filterFocusedNodesRelations(
  viewStore: ViewStore,
  r: GraphRelation,
  relatedNode: GraphNode,
  precedingFocusedNodeInPath?: GraphNode,
) {
  /** The relation points from the related node to the focused node */
  const isBackwards = r.from.id === relatedNode.id;
  if (viewStore.hideBackrelations && isBackwards) {
    return false;
  }
  /** Parent from the perspective of the graph, not the current tree */
  const isGraphParent = isBackwards && r.type.id === defaultRelationTypes.child.id;
  if (viewStore.hideAllParents && isGraphParent) {
    return false;
  } else if (viewStore.hideAllRootParents && isGraphParent && relatedNode.isRoot) {
    return false;
  } else if (viewStore.hideDirectParent && relatedNode.id === precedingFocusedNodeInPath?.id) {
    return false;
  }
  return true;
}
