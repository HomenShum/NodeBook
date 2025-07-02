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

import LineLoader from "@/app/components/LineLoader/LineLoader";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { Dropdown, Match } from "@/app/editor/plugins/dropdown/types";
import { GraphNode } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { cn } from "@/lib/utils";

import { DropdownItem } from "./DropdownItem";

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
  // State to track if the list has overflow
  const [hasOverflow, setHasOverflow] = useState(false);
  // State to track if scrolled to bottom
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  // Check if list has overflow whenever matches or highlighted index changes
  useEffect(() => {
    if (listRef.current && state) {
      const hasScrollableContent = listRef.current.scrollHeight > listRef.current.clientHeight;
      setHasOverflow(hasScrollableContent);

      // Initially check if it's scrolled to bottom
      const isAtBottom =
        Math.abs(listRef.current.scrollHeight - listRef.current.scrollTop - listRef.current.clientHeight) < 1;
      setIsScrolledToBottom(isAtBottom);
    }
  }, [state, highlightedIndex]);

  // Add scroll event listener to track when user scrolls to bottom
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    const handleScroll = () => {
      // Check if scrolled to bottom (with a small tolerance for rounding errors)
      const isAtBottom = Math.abs(listElement.scrollHeight - listElement.scrollTop - listElement.clientHeight) < 1;
      setIsScrolledToBottom(isAtBottom);
    };

    listElement.addEventListener("scroll", handleScroll);
    return () => {
      listElement.removeEventListener("scroll", handleScroll);
    };
  }, []);

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
      // todo: those events are registered dozens of times
      // unregister is not working correctly
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
      <LineLoader height={2} />
      <ul ref={listRef}>
        {state.matches.map((match, index) => (
          <DropdownItem
            key={match.key}
            index={index}
            isSelected={highlightedIndex === index}
            isNotOwned={match.object.authorId !== graphStore.user.id}
            onMouseEnter={() => mouseMoveSinceStateChange.current && setHighlightedIndex(index)}
            onClick={(e) => selectMatch(match)}
            showTabHelper={highlightedIndex === null}
            match={match}
            searchText={dropdown?.search ?? ""}
          />
        ))}
      </ul>
      {hasOverflow && !isScrolledToBottom && <div className={styles.BottomGradient} />}
    </div>
  );
});
