import { Dot, Ellipsis } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Editor } from "../../editor/Editor";
import { Bullet } from "../../model/OutlineBullet";
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
import { Position } from "@/app/util";
import { cn } from "@/lib/utils";
import { action } from "mobx";
import { useEffect, useRef, useState } from "react";
import { BulletChildren } from "../BulletChildren";
import { RelationCombobox } from "../RelationCombobox";

export const Toggle = observer(({ bullet }: { bullet: Bullet }) => {
  const viewStore = useViewStore();
  return (
    <button
      style={{
        backgroundColor: "transparent",
        border: "none",
        width: "1rem",
        fontSize: "0.75rem",
        color: viewStore.hoveredNode?.id === bullet.id ? "black" : "transparent",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => bullet.toggleExpanded()}
    >
      {bullet.isExpanded ? "▼" : "▶"}
    </button>
  );
});

interface Props {
  bullet: Bullet;
  depth?: number;
  parents?: Bullet[];
  siblingAbove?: Bullet;
  siblingBelow?: Bullet;
  position?: Position;
}

export const BulletView = observer(
  ({ bullet, position, depth = 0, parents = [], siblingAbove, siblingBelow }: Props) => {
    const viewStore = useViewStore();
    const graphStore = useGraphStore();
    // TODO: this was really shoehorned in here for demo day and should be refactored
    const [updatingRelationType, setUpdatingRelationType] = useState(false);

    const hasChildren = getFilteredRelationsCount(viewStore, bullet);

    const isSelected = viewStore.selectedNodes.has(bullet);
    const isChild =
      bullet.graphRelation?.type.id === defaultRelationTypes.child.id &&
      bullet.graphRelation?.to.id === bullet.graphNode.id;

    return (
      <>
        <div className={cn("flex flex-col align-start", isSelected ? "bg-sky-200" : "")}>
          <div
            className="flex items-center gap-1 my-1 relative"
            onMouseEnter={() => viewStore.setHoveredNode(bullet)}
            onMouseLeave={() => viewStore.setHoveredNode(null)}
          >
            {/* toggle, bullet, menu */}
            <div className="flex items-center gap-1 absolute right-full">
              <BulletMenu bullet={bullet} setUpdatingRelationType={setUpdatingRelationType} />
              {hasChildren && <Toggle bullet={bullet} />}
            </div>
            <div className="w-4 relative h-4 mr-1">
              {hasChildren && !bullet.isExpanded && (
                <Dot
                  stroke="#ddd"
                  height={16}
                  strokeWidth={18}
                  className={cn(
                    "cursor-pointer absolute top-0",
                    // When the parent is a bundle, only show bullets on hover
                    bullet.parent?.type === "bundle"
                      ? viewStore.hoveredNode?.id === bullet.id
                        ? "text-grey-800"
                        : "text-transparent"
                      : "",
                  )}
                  onClick={() => viewStore.setCurrentOutlineViewRoot(bullet)}
                />
              )}
              <Dot
                strokeWidth={7}
                height={16}
                className={cn(
                  "cursor-pointer absolute top-0",
                  // When the parent is a bundle, only show bullets on hover
                  bullet.parent!.type === "bundle"
                    ? viewStore.hoveredNode?.id === bullet.id
                      ? "text-grey-800"
                      : "text-transparent"
                    : "",
                )}
                onClick={() => viewStore.setCurrentOutlineViewRoot(bullet)}
              />
            </div>
            {/* relation and node */}
            <div className="flex flex-col flex-1">
              <div className="flex gap-2">
                {!isChild || updatingRelationType ? (
                  <RelationCombobox bullet={bullet} setUpdatingRelationType={setUpdatingRelationType} />
                ) : null}
                {!bullet.replacing ? (
                  <BulletEditor bullet={bullet} siblingAbove={siblingAbove} siblingBelow={siblingBelow} />
                ) : (
                  <ReplacingNodeView bullet={bullet} />
                )}
              </div>
              {viewStore.showNodeDetails && !bullet.replacing && <BulletDetails bullet={bullet} position={position} />}
            </div>
          </div>
          {bullet.isExpanded && <BulletChildren bullet={bullet} depth={depth + 1} parents={[...parents, bullet]} />}
        </div>
      </>
    );
  },
);

const BulletMenu = observer(
  ({ bullet, setUpdatingRelationType }: { bullet: Bullet; setUpdatingRelationType: (v: boolean) => void }) => {
    const viewStore = useViewStore();
    const graphStore = useGraphStore();
    return (
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Ellipsis className={cn(viewStore.hoveredNode?.id === bullet.id ? "text-grey-800" : "text-transparent")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem onSelect={() => graphStore.deleteRelation(bullet.graphRelation!)}>
            Delete relation
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => bullet.setReplacing(true)}>Replace related node</DropdownMenuItem>
          {bullet.isPinned ? (
            <DropdownMenuItem onSelect={() => bullet.unpin()}>Unpin</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => bullet.pin()}>Pin</DropdownMenuItem>
          )}
          {bullet.type === "bullet" ? (
            <DropdownMenuItem onSelect={() => bullet.setType("bundle")}>Convert to bundle</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => bullet.setType("bullet")}>Convert to bullet</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setUpdatingRelationType(true)}>Change relation type</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={action(() => {
              bullet.createChild();
              bullet.setIsExpanded(true);
            })}
          >
            Add child
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

const BulletEditor = observer(
  ({ bullet, siblingAbove, siblingBelow }: { bullet: Bullet; siblingAbove?: Bullet; siblingBelow?: Bullet }) => {
    return (
      <div
        style={{
          gap: "5px",
          display: "flex",
          alignItems: "flex-start",
          flex: 1,
        }}
      >
        <div className={cn("flex flex-col flex-1", bullet.type === "bundle" && "text-xl")}>
          <Editor
            bullet={bullet}
            onChange={(v) => bullet.graphNode.setContent([{ type: "text", value: v }] ?? [])}
            context={{ bullet: bullet, siblingAbove, siblingBelow }}
          />
        </div>
      </div>
    );
  },
);

const BulletDetails = observer(({ bullet, position }: { bullet: Bullet; position?: Position }) => {
  return (
    <div style={{ display: "flex", fontSize: "0.75rem", gap: "10px" }}>
      <span style={{ color: "gray" }}>bulletId: {bullet.id}</span>
      {position && (
        <span style={{ color: "gray" }}>
          position: {position.int}-{position.frac}
        </span>
      )}
      <span style={{ color: "gray" }}>nodeId: {bullet.graphNode.id}</span>
      <span style={{ color: "gray" }}>relationId: {bullet.graphRelation!.id}</span>
      <span style={{ color: "gray" }}>createdAt: {bullet.graphNode.createdAt.toISOString()}</span>
    </div>
  );
});

const ReplacingNodeView = observer(({ bullet }: { bullet: Bullet }) => {
  return (
    <div className="ml-4 flex-1">
      <SearchNodes
        currentNode={bullet.graphNode}
        onSelect={action((graphNode) => {
          bullet.setGraphNode(graphNode);
          bullet.setReplacing(false);
        })}
        cancel={() => {
          bullet.setReplacing(false);
        }}
      />
    </div>
  );
});

function SearchNodes({
  currentNode,
  onSelect,
  cancel,
}: {
  currentNode: GraphNode;
  onSelect: (node: GraphNode) => void;
  cancel: () => void;
}) {
  const graph = useGraphStore();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const options = graph.nodes.filter(
    (node) => node.id !== currentNode.id && node.text.toLowerCase().includes(filter.toLowerCase()),
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
        cancel();
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
  }, [cancel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selected !== null) {
          onSelect(options[selected]);
        } else {
          cancel();
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
  }, [cancel, onSelect, selected, options]);

  return (
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

export function getFilteredRelationsCount(viewStore: ViewStore, bullet: Bullet) {
  return (
    bullet.graphNode.relations.filter((r) => {
      const relatedNode = r.from.id === bullet.graphNode.id ? r.to : r.from;
      const grandparentNode = bullet.parent?.graphNode!;
      return filterFocusedNodesRelations(viewStore, r, relatedNode, grandparentNode);
    }).length > 0
  );
}
