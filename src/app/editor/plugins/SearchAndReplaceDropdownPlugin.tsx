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

import { useViewType } from "@/app/components/RelatedObject/ViewTypeContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation, GraphRelationType } from "@/app/graph/GraphRelation";
import { useRenderController } from "@/app/render/useRenderController";
import { cn } from "@/lib/utils";
import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/graph/useGraphStore";

/**
 * Dropdown options:
 * - Replace the current object with the selected object
 * - Set the relation type of the current relation
 * - Create a new node
 *
 * Dropdown options are filtered based on the current object's text content.
 */
export const AutocompleteDropdownPlugin = observer(({ parentRef }: { parentRef: React.RefObject<HTMLDivElement> }) => {
  const graph = useGraphStore();
  const renderController = useRenderController();
  const { object, relation, pathToParentRelations, pathToNodeStr, isChild } = useRelationAtPath();
  const { viewType } = useViewType();
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
          node.id !== object.id && keywords.every((keyword) => node.text.toLowerCase().includes(keyword.toLowerCase())),
      )
      // Exact matches with `object.text` at the top. Prefix matches with `object.text` next. Substring matches last.
      .sort((a, b) => {
        if (a.text === object.text) return -1;
        if (b.text === object.text) return 1;
        if (a.text.startsWith(object.text)) return -1;
        if (b.text.startsWith(object.text)) return 1;
        return a.text.localeCompare(b.text);
      });
    // Filter relations that match the search
    const relations: GraphRelation[] = graph.relations.filter(
      (r) =>
        r.id !== object.id &&
        r.id !== relation.id &&
        r.to.id !== object.id && // ignore relations to this object
        !(r.from instanceof GraphNode && r.from.isBundle) && // ignore relations from bundles
        keywords.every((keyword) => r.text.toLowerCase().includes(keyword.toLowerCase())),
    );
    // Filter relation types that match the search
    let relationTypeOptions: DropdownOption[] = [];
    if (isChild && keywords.length > 0) {
      graph.relationTypes.forEach((rt) => {
        if (rt.id === relation.relationType.id) {
          return;
        }
        if (keywords.every((keyword) => rt.label.toLowerCase().includes(keyword.toLowerCase()))) {
          relationTypeOptions.push({ id: rt.id + "-fwd", object: rt, type: "relationType", isForward: true });
        }
        if (keywords.every((keyword) => rt.reverseLabel.toLowerCase().includes(keyword.toLowerCase()))) {
          relationTypeOptions.push({ id: rt.id + "-rev", object: rt, type: "relationType", isForward: false });
        }
      });
    }
    const actionOptions: DropdownOption[] = [];
    // object.relations.length > 1 ? [{ type: "action", id: "create-new-node" }] : [];
    return [
      ...relationTypeOptions,
      ...nodes.map((node) => ({ type: "node" as const, id: node.id, object: node })),
      ...relations.map((relation) => ({ type: "relation" as const, id: relation.id, object: relation })),
      ...actionOptions,
    ];
  }, [
    graph.nodes,
    graph.relations,
    graph.relationTypes,
    object.id,
    object.text,
    relation.id,
    hasFocus,
    relation.relationType.id,
    isChild,
  ]);

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

  const onSelect = useCallback(
    (option: DropdownOption) => {
      if (option.type === "relationType") {
        // update the relation type of the current relation
        graph.updateRelationsType(relation, option.object);
        if (!option.isForward) {
          graph.reverseRelation(relation);
        }
        if (object instanceof GraphNode) {
          object.setContent("");
          renderController.setFocusedNode(pathToNodeStr);
        }
      } else {
        // replace the current object with the selected object
        const newObject: GraphNode | GraphRelation =
          option.type === "action" && option.id === "create-new-node"
            ? graph.createNode({ content: object.text })
            : option.object;

        graph.setGraphNodeAtPath([...pathToParentRelations, relation], newObject);
        renderController.setFocusedNode(pathToNodeStr);
        if (object.relations.every((r) => r.from.id === graph.thoughtstreamRoot.id)) {
          graph.deleteNode(object.id);
        }
      }
      closeDropdown();
    },
    [graph, pathToParentRelations, relation, renderController, pathToNodeStr, closeDropdown, object],
  );

  // Register keyboard commands for the dropdown
  useEffect(() => {
    if (viewType === "temp-edit") {
      return;
    }
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
    viewType,
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
  return hasFocus && dropdownOpen && viewType !== "temp-edit" && objectsMatchingSearch.length > 0 ? (
    <div className="absolute top-6 left-0 w-full bg-white border border-gray-300 z-10">
      {objectsMatchingSearch.map((option, i) => {
        return (
          <div
            key={option.id}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(option);
            }}
            onMouseEnter={() => mouseHasMoved && setSelected(option.id)}
            className={cn(i === selectedIdx ? "bg-gray-200" : "")}
          >
            {option.type === "action" && option.id === "create-new-node" ? (
              `Create new node "${object.text}"`
            ) : option.type === "node" ? (
              option.object.text
            ) : option.type === "relationType" ? (
              <span className="text-gray-400">
                {option.isForward ? option.object.label : option.object.reverseLabel}:
              </span>
            ) : option.type === "relation" ? (
              <span>{option.object.text}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  ) : null;
});

type DropdownOption =
  | { type: "node"; id: string; object: GraphNode }
  | { type: "relation"; id: string; object: GraphRelation }
  | { type: "relationType"; id: string; object: GraphRelationType; isForward: boolean }
  | { type: "action"; id: "create-new-node" };
