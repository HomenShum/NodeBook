import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { sortByPrefixMatch } from "@/app/util";
import { DescendantTreeNode } from "@/app/view/Tree";

import styles from "./ReplaceRelatedNodeView.module.css";

export const ReplaceRelatedNodeView = ({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const currentObject = treeNode.object;
  const relation = treeNode.relationWithParent;
  const graph = useGraphStore();
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { setViewType } = useTreeNode();
  const { optionsFlat: options, optionsGrouped } = useMemo(() => {
    const keywords = filter.split(/\s+/);
    const nodeOptions = graph.nodes.filter(
      (node) =>
        node.id !== currentObject.id &&
        keywords.every((keyword) => node.text.toLowerCase().includes(keyword.toLowerCase())),
    );
    sortByPrefixMatch(nodeOptions, filter);

    const relationOptions = graph.relations.filter(
      (r) =>
        r.id !== currentObject.id &&
        r.id !== relation.id &&
        keywords.every((keyword) => r.text.toLowerCase().includes(keyword.toLowerCase())),
    );
    sortByPrefixMatch(relationOptions, filter);

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
    async (obj: GraphObject) => {
      await graph.replaceRelationLink({
        direction: treeNode.relationWithParent.to.id === treeNode.object.id ? "to" : "from",
        relationId: treeNode.relationWithParent.id,
        replaceWith:
          obj instanceof GraphNode ? { type: "existing-node", id: obj.id } : { type: "existing-relation", id: obj.id },
      });
      setViewType("edit");
    },
    [treeNode, graph, setViewType],
  );

  useEffect(() => {
    setTimeout(() => {
      ref.current?.querySelector("input")?.focus();
    }, 0);
  }, []);

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
    <div className={styles.ReplaceRelatedDropdown}>
      <div ref={ref} className={styles.ReplaceRelatedDropdownContainer}>
        <input
          placeholder="Search nodes..."
          autoFocus
          className={styles.ReplaceRelatedInput}
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className={styles.ReplaceRelatedContent}>
          {optionsGrouped.map((group) => (
            <div key={group.type}>
              <div className={styles.ReplaceRelatedLabel}>{group.type}</div>
              {group.options.map(
                ({ index, object, text }) =>
                  text && ( // avoiding empty nodes being rendered into the search results
                    <div
                      key={object.id}
                      onClick={() => onSelect(object)}
                      onMouseEnter={() => setSelected(index)}
                      className={`${styles.ReplaceRelatedItem} ${
                        selected === index && styles.ReplaceRelatedItemSelected
                      } `}
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
};
