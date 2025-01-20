import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_NORMAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from "lexical";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Path } from "@/app/components/Path";
import { RelationCounter } from "@/app/components/RelatedObject/RelationCounter";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { Dropdown, Match } from "@/app/editor/plugins/dropdown/types";
import { graphNodeIsCustomRelType } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { getCanonicalPath } from "@/app/graph/utils";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { cn } from "@/lib/utils";

import styles from "./DropdownPlugin.module.css";

interface Props {
  treeNode: DescendantTreeNode;
  closeDropdown: () => void;
  dropdown: Dropdown;
}

export const SearchAndReplaceDropdown = observer(function SearchAndReplaceDropdown({
  treeNode,
  closeDropdown,
  dropdown,
}: Props) {
  const state = useMemo(() => {
    return dropdown?.type === "searchAndReplace"
      ? {
          matches: dropdown.matches,
          initiatedManually: dropdown.initiatedManually,
        }
      : null;
  }, [dropdown]);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [editor] = useLexicalComposerContext();
  const tree = treeNode.tree;
  const graphStore = useGraphStore();
  // We only want to highlight where the mouse is when the user intentionally puts it there.
  // If the dropdown opens overtop of where the mouse was, we don't want to highlight that option.
  const mouseMoveSinceStateChange = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset highlighted index when options change (but only once they've been set)
  useEffect(() => {
    if (state) {
      setHighlightedIndex(state.initiatedManually ? 0 : null);
    } else {
      setHighlightedIndex(null);
    }
    mouseMoveSinceStateChange.current = false;
  }, [state]);

  const selectMatch = useCallback(
    async (match: Match) => {
      if (match.type === "relationType") {
        const relation = treeNode.relationWithParent;
        await graphStore.updateRelation({
          relationId: relation.id,
          relationProps: { relationType: match.object },
          reverse: !match.isForward,
        });
        if (treeNode.object instanceof GraphNode) {
          await graphStore.updateNode({ nodeId: treeNode.object.id, nodeProps: { content: "" } });
        }
      } else {
        await treeNode.setObject(match.object);
      }
      tree.setFocusedNode(treeNode.path);
    },
    [graphStore, tree, treeNode],
  );

  useEffect(() => {
    if (!state) return;
    const nodes = state.matches;

    function scrollToElement(index: number) {
      const highlightedElement = listRef.current?.children[index] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }

    return mergeRegister(
      // Set current node to highlighted object on enter
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          const match = highlightedIndex !== null ? nodes[highlightedIndex] : null;
          if (match) {
            if (event) {
              event.preventDefault();
              event.stopPropagation();
            }
            selectMatch(match);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      // Set current node to highlighted object on tab (or first if none is highlighted)
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          const index = highlightedIndex ?? 0;
          const match = nodes[index];
          if (match) {
            event.preventDefault();
            event.stopPropagation();
            selectMatch(match);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      // Close dropdown on escape
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (event) {
            event.preventDefault();
            event.stopPropagation();
          }
          closeDropdown();
          setHighlightedIndex(null);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (nodes.length === 0) return false;
          event.preventDefault();
          event.stopPropagation();
          const nextIndex =
            highlightedIndex === null || highlightedIndex === nodes.length - 1 ? 0 : highlightedIndex + 1;
          setHighlightedIndex(nextIndex);
          scrollToElement(nextIndex);
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (nodes.length === 0) return false;
          event.preventDefault();
          event.stopPropagation();
          const nextIndex =
            highlightedIndex === null || highlightedIndex === 0 ? nodes.length - 1 : highlightedIndex - 1;
          setHighlightedIndex(nextIndex);
          scrollToElement(nextIndex);
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      () => {
        const handleClickOutside = (event: MouseEvent) => {
          const target = event.target as Node;
          if (ref.current && !ref.current.contains(target)) {
            closeDropdown();
            setHighlightedIndex(null);
          }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      },
      () => {
        const handleMouseMove = () => {
          mouseMoveSinceStateChange.current = true;
        };
        document.addEventListener("mousemove", handleMouseMove);
        return () => {
          document.removeEventListener("mousemove", handleMouseMove);
        };
      },
    );
  }, [editor, state, treeNode, tree, highlightedIndex, closeDropdown, selectMatch]);

  if (state === null || state.matches.length === 0) {
    return null;
  }
  return (
    <div ref={ref} className={cn(styles.Dropdown, styles.SearchAndReplace)}>
      <ul ref={listRef}>
        {state.matches.map((match, index) => (
          <li
            key={match.key}
            className={highlightedIndex === index ? styles.Selected : ""}
            onMouseEnter={() => mouseMoveSinceStateChange.current && setHighlightedIndex(index)}
            onClick={() => selectMatch(match)}
          >
            <div className={styles.DropdownItem}>
              {match.type === "relationType" ? (
                <div>{match.isForward ? match.object.label : match.object.reverseLabel}:</div>
              ) : (
                <>
                  <div className={styles.DropdownItemContent}>
                    <div>{match.object.text}</div>
                    <div className={styles.DropdownItemHelper}>
                      {index === 0 && highlightedIndex === null && (
                        <div className={styles.DropdownHelper}>Tab to select </div>
                      )}
                      {match.type === "node" && graphNodeIsCustomRelType(match.object, true) ? (
                        <div
                          style={{
                            padding: "0 6px",
                            background: "var(--gray-2)",
                            height: "18px",
                            borderRadius: "4px",
                            fontSize: "var(--font-size-mini)",
                            color: "var(--gray-10)",
                          }}
                        >
                          Type
                        </div>
                      ) : null}
                      {match.type === "node" ? <RelationCounter object={match.object} showTooltip={false} /> : null}
                    </div>
                  </div>
                  {match.type === "node" ? <Path path={getCanonicalPath(match.object)} /> : null}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});
