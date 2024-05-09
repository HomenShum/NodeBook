import { useViewController } from "@/app/controller/useViewController";
import { GraphNode } from "@/app/model/GraphNode";
import { GraphRelation } from "@/app/model/GraphRelation";
import { cn } from "@/lib/utils";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  FOCUS_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
} from "lexical";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRelationAtPath } from "../../components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "../../store/useGraphStore";

/**
 * A plugin that will surface a dropdown with objects that match the content
 * of the current object. The user can select an object from the dropdown to
 * replace the current object with the selection.
 */
export const SearchAndReplaceDropdownPlugin = observer(
  ({ parentRef }: { parentRef: React.RefObject<HTMLDivElement> }) => {
    const graph = useGraphStore();
    const viewController = useViewController();
    const { object, relation, pathToParentRelations, pathToNodeStr } = useRelationAtPath();
    const [editor] = useLexicalComposerContext();
    const [selected, setSelected] = useState<string | number | null>(0);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [hasFocus, setHasFocus] = useState(editor.getRootElement()?.contains(document.activeElement) ?? false);
    const [mouseHasMoved, setMouseHasMoved] = useState(false);

    // Track whether the mouse has moved after the dropdown was opened. We only want to
    // set the selection to the mouse position if the mouse was intentionally moved there.
    useEffect(() => {
      if (dropdownOpen) {
        const handleMouseMove = () => {
          setMouseHasMoved(true);
          document.removeEventListener("mousemove", handleMouseMove);
        };
        document.addEventListener("mousemove", handleMouseMove);
      }
    }, [dropdownOpen]);

    const closeDropdown = useCallback(() => {
      setDropdownOpen(false);
      setSelected(0);
      setMouseHasMoved(false);
    }, []);

    // If the user clicks anywhere that's not the input or dropdown, close the dropdown
    useEffect(() => {
      const handleClick = (e: MouseEvent) => {
        if (parentRef.current && !parentRef.current.contains(e.target as Node)) {
          closeDropdown();
        }
      };
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }, [parentRef, closeDropdown]);

    // Filter nodes that match the search
    const objectsMatchingSearch = useMemo<DropdownOption[]>(() => {
      if (!hasFocus || object.text === "") {
        return [];
      }
      const keywords = object.text.split(/\s+/);
      const nodes: GraphNode[] = graph.nodes
        .filter(
          (node) =>
            node.id !== object.id &&
            keywords.every((keyword) => node.text.toLowerCase().includes(keyword.toLowerCase())),
        )
        // Exact matches with `object.text` at the top. Prefix matches with `object.text` next. Substring matches last.
        .sort((a, b) => {
          if (a.text === object.text) return -1;
          if (b.text === object.text) return 1;
          if (a.text.startsWith(object.text)) return -1;
          if (b.text.startsWith(object.text)) return 1;
          return a.text.localeCompare(b.text);
        });
      const relations: GraphRelation[] = graph.relations.filter(
        (r) =>
          r.id !== object.id &&
          r.id !== relation.id &&
          keywords.every((keyword) => r.text.toLowerCase().includes(keyword.toLowerCase())),
      );
      const actionOptions: DropdownOption[] =
        object.relations.length > 1 ? [{ type: "action", id: "create-new-node" }] : [];
      return [
        ...nodes.map((node) => ({ type: "node" as const, id: node.id, object: node })),
        ...relations.map((relation) => ({ type: "relation" as const, id: relation.id, object: relation })),
        ...actionOptions,
      ];
    }, [graph.nodes, graph.relations, object.id, object.text, relation.id, object.relations, hasFocus]);

    /**
     * Given a selected option's id or index, return the index of the selected option
     * in the provided options array.
     */
    const findSelectionIdx = useCallback((options: DropdownOption[], selected: string | number | null) => {
      if (selected === null) {
        return -1;
      } else if (typeof selected === "number") {
        return selected;
      } else {
        return options.findIndex((o) => o.id === selected);
      }
    }, []);

    // Select a node from the dropdown
    const onSelect = useCallback(
      (option: DropdownOption) => {
        const newObject: GraphNode | GraphRelation =
          option.type === "action" && option.id === "create-new-node"
            ? graph.createNode({ content: object.text })
            : option.object;
        graph.setGraphNodeAtPath([...pathToParentRelations, relation], newObject);
        viewController.setFocusedNode(pathToNodeStr);
        closeDropdown();
      },
      [graph, pathToParentRelations, relation, viewController, pathToNodeStr, object.text, closeDropdown],
    );

    // Register keyboard commands for the dropdown
    useEffect(() => {
      const unsubscribe = mergeRegister(
        editor.registerCommand<KeyboardEvent>(
          KEY_ARROW_UP_COMMAND,
          (event) => {
            if (dropdownOpen && objectsMatchingSearch.length > 0) {
              if (selected === null) {
                setSelected(0);
              } else {
                const selectedIdx = findSelectionIdx(objectsMatchingSearch, selected);
                const nextIdx = (selectedIdx - 1 + objectsMatchingSearch.length) % objectsMatchingSearch.length;
                setSelected(objectsMatchingSearch[nextIdx].id ?? null);
              }
              return true;
            }
            return false;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand<KeyboardEvent>(
          KEY_ARROW_DOWN_COMMAND,
          (event) => {
            if (dropdownOpen && objectsMatchingSearch.length > 0) {
              if (selected === null) {
                setSelected(objectsMatchingSearch[0].id ?? null);
              } else {
                const selectedIdx = findSelectionIdx(objectsMatchingSearch, selected);
                const nextIdx = (selectedIdx + 1) % objectsMatchingSearch.length;
                setSelected(objectsMatchingSearch[nextIdx].id ?? null);
              }
              return true;
            }
            return false;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand<KeyboardEvent>(
          KEY_ENTER_COMMAND,
          (event) => {
            if (dropdownOpen && objectsMatchingSearch.length > 0) {
              event.preventDefault();
              const idx = findSelectionIdx(objectsMatchingSearch, selected);
              if (objectsMatchingSearch[idx]) {
                onSelect(objectsMatchingSearch[idx]);
              }
              return true;
            }
            return false;
          },
          // High priority so it takes precedence over the split on enter command
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerCommand<KeyboardEvent>(
          KEY_ESCAPE_COMMAND,
          (event) => {
            closeDropdown();
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerCommand(
          FOCUS_COMMAND,
          () => {
            setHasFocus(true);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          BLUR_COMMAND,
          () => {
            setHasFocus(false);
            // Don't close dropdown here. If you do, clicking on the dropdown blurs the editor
            // first, which closes the dropdown, and so the dropdown doesn't get the click event.
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      );
      return unsubscribe;
    }, [
      editor,
      dropdownOpen,
      setDropdownOpen,
      closeDropdown,
      objectsMatchingSearch,
      selected,
      setSelected,
      onSelect,
      findSelectionIdx,
    ]);

    // Open the dropdown when the text content changes while the editor is focused
    const hasFocusRef = useRef(hasFocus);
    hasFocusRef.current = hasFocus;
    useEffect(() => {
      const unsubscribe = editor.registerTextContentListener((text) => {
        if (hasFocusRef.current) {
          if (text === "") {
            closeDropdown();
          } else if (text !== object.text) {
            setDropdownOpen(true);
          }
        }
      });
      return unsubscribe;
    }, [editor, object.text, closeDropdown]);

    const selectedIdx = findSelectionIdx(objectsMatchingSearch, selected);
    return hasFocus && dropdownOpen && objectsMatchingSearch.length > 0 ? (
      <div className="absolute top-6 left-0 w-full bg-white border border-gray-300 z-10">
        {objectsMatchingSearch.map((option, i) => {
          return (
            <div
              key={option.id}
              onClick={() => onSelect(option)}
              onMouseEnter={() => mouseHasMoved && setSelected(option.id)}
              className={cn(i === selectedIdx ? "bg-gray-200" : "")}
            >
              {option.type === "action" && option.id === "create-new-node" ? (
                `Create new node "${object.text}"`
              ) : option.type === "node" ? (
                option.object.text
              ) : (
                <span>
                  <span className="text-gray-400">Relation:</span>
                  {option.object.text}
                </span>
              )}
            </div>
          );
        })}
      </div>
    ) : null;
  },
);

type DropdownOption =
  | { type: "node"; id: string; object: GraphNode }
  | { type: "relation"; id: string; object: GraphRelation }
  | { type: "action"; id: "create-new-node" };
