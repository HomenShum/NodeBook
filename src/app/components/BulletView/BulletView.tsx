import { observer } from "mobx-react-lite";
import { Editor } from "../../editor/Editor";
import { Bullet } from "../../model/OutlineBullet";
import { useGraphStore } from "../../store/graph";
import { useViewStore } from "../../store/outline";
import { RelationCombobox } from "../RelationCombobox";
import styles from "./BulletView.module.css";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { GraphNode } from "@/app/model/GraphNode";
import { useEffect, useRef, useState } from "react";
import { BulletChildren } from "../BulletChildren";

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
}

export const BulletView = observer(({ bullet, depth = 0, parents = [], siblingAbove, siblingBelow }: Props) => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();

  const [replacing, setReplacing] = useState(false);

  const onDelete = () => {
    graphStore.deleteRelation(bullet.graphRelation!);
  };

  return (
    <>
      <div
        className="flex flex-col align-start"
        onMouseEnter={() => viewStore.setHoveredNode(bullet)}
        onMouseLeave={() => viewStore.setHoveredNode(null)}
      >
        <div className="flex items-center">
          <div style={{ display: "flex", gap: "5px" }}>
            <DropdownMenu>
              <DropdownMenuTrigger>...</DropdownMenuTrigger>
              <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem onSelect={onDelete}>Delete relation</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setReplacing(true)}>Replace related node</DropdownMenuItem>
                {bullet.isPinned ? (
                  <DropdownMenuItem onSelect={() => bullet.unpin()}>Unpin</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => bullet.pin()}>Pin</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <RelationCombobox bullet={bullet} />
          </div>
          {!replacing ? (
            <>
              <Toggle bullet={bullet} />
              <span
                className={styles.bulletChar}
                onClick={() => {
                  console.log("clicked bullet");
                  viewStore.outlineViewStore.setRoot(bullet);
                }}
              >
                {"\u2022"}
              </span>
              {/* relation type */}
              <div
                style={{
                  gap: "5px",
                  display: "flex",
                  alignItems: "flex-start",
                  flex: 1,
                }}
              >
                <div className="flex flex-col flex-1">
                  <Editor
                    node={bullet}
                    onChange={(v) => bullet.graphNode.setText(v ?? "")}
                    context={{ node: bullet, siblingAbove, siblingBelow }}
                  />
                  {viewStore.showNodeDetails && (
                    <div style={{ display: "flex", fontSize: "0.75rem", gap: "10px" }}>
                      <span style={{ color: "gray" }}>bulletId: {bullet.id}</span>
                      <span style={{ color: "gray" }}>position: {bullet.position}</span>
                      <span style={{ color: "gray" }}>nodeId: {bullet.graphNode.id}</span>
                      <span style={{ color: "gray" }}>relationId: {bullet.graphRelation!.id}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="ml-4 flex-1">
              <SearchNodes
                currentNode={bullet.graphNode}
                onSelect={(graphNode) => {
                  bullet.setGraphNode(graphNode);
                  setReplacing(false);
                }}
                cancel={() => setReplacing(false)}
              />
            </div>
          )}
        </div>
        {bullet.isExpanded && <BulletChildren bullet={bullet} depth={depth + 1} parents={[...parents, bullet]} />}
      </div>
    </>
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
        console.log("click outside");
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
