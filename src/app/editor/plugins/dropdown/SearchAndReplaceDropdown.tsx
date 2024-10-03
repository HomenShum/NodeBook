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
import { Dropdown, Match } from "@/app/editor/plugins/dropdown/types";
import { GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
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
  const tree = useTree();
  const graphStore = useGraphStore();

  // Reset highlighted index when options change (but only once they've been set)
  useEffect(() => {
    if (state) {
      setHighlightedIndex(state.initiatedManually ? 0 : null);
    } else {
      setHighlightedIndex(null);
    }
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
          console.log("escape");
          if (event) {
            event.preventDefault();
            event.stopPropagation();
          }
          closeDropdown();
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
          setHighlightedIndex((prevIndex) =>
            prevIndex === null || prevIndex === nodes.length - 1 ? 0 : prevIndex + 1,
          );
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
          setHighlightedIndex((prevIndex) =>
            prevIndex === null || prevIndex === 0 ? nodes.length - 1 : prevIndex - 1,
          );
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      () => {
        const handleClickOutside = (event: MouseEvent) => {
          const target = event.target as Node;
          if (ref.current && !ref.current.contains(target)) {
            closeDropdown();
          }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      },
    );
  }, [editor, state, treeNode, tree, highlightedIndex, closeDropdown, selectMatch]);

  if (state === null || state.matches.length === 0) {
    return null;
  }
  return (
    <div ref={ref} className={cn(styles.Dropdown, styles.SearchAndReplace)}>
      <ul>
        {state.matches.map((match, index) => (
          <li
            key={match.key}
            className={highlightedIndex === index ? styles.Selected : ""}
            onMouseEnter={() => setHighlightedIndex(index)}
            onClick={() => selectMatch(match)}
          >
            <div className={styles.DropdownItem}>
              {match.type === "relationType" ? (
                <div>{match.isForward ? match.object.label : match.object.reverseLabel}:</div>
              ) : (
                <>
                  <div>{match.object.text}</div>
                  {match.type === "node" ? <Path path={match.object.getPath()} /> : null}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});
