import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getTextContent,
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

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { GraphRelation, GraphRelationType } from "@/app/graph/GraphRelation";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useTree } from "@/app/tree/TreeContext";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

import styles from "./AutocompleteDropdownPlugin.module.css";

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
  const tree = useTree();
  const { treeNode } = useTreeNode();
  const [editor] = useLexicalComposerContext();
  const [selected, setSelected] = useState<string | number | null>(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hasFocus, setHasFocus] = useState(editor.getRootElement()?.contains(document.activeElement) ?? false);
  const [mouseHasMoved, setMouseHasMoved] = useState(false);
  const object = treeNode.object;
  const relation = treeNode.relationWithParent;
  const isLabellingRelation = relation.isLabelled();
  const pathToNodeStr = treeNode.path;
  const [editedSinceFocused, setEditedSinceFocused] = useState(false);
  const [textOnFocus, setTextOnFocus] = useState(object.text);

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
    const shouldUpdate = hasFocus && editedSinceFocused && object.text !== "";
    if (!shouldUpdate) {
      return [];
    }
    const searchText = object.text.toLocaleLowerCase();

    // Filter nodes that match the search

    let { nodes, relations, relationTypes } = graph.search({
      text: searchText,
      filters: {
        types: isLabellingRelation ? ["node", "relation"] : ["node", "relation", "relationType"],
      },
      sort: { by: "score" },
    });
    // ignore the current object and relation
    nodes = nodes.filter(({ node }) => node.id !== treeNode.object.id);
    relations = relations.filter(
      ({ relation }) => relation.id !== treeNode.object.id && relation.id !== treeNode.relationWithParent.id,
    );
    relationTypes = relationTypes.filter(({ relationType }) => relationType.id !== relation.relationType.id);

    // map to dropdown options
    return [
      ...(relationTypes
        .map(({ relationType }) => {
          if (relationType.label.toLowerCase().includes(searchText)) {
            return { id: relationType.id + "-fwd", object: relationType, type: "relationType", isForward: true };
          }
          if (relationType.reverseLabel.toLowerCase().includes(searchText)) {
            return { id: relationType.id + "-rev", object: relationType, type: "relationType", isForward: false };
          }
        })
        .filter(Boolean)
        .slice(0, 5) as DropdownOption[]),
      ...nodes.map(({ node }) => ({ type: "node" as const, id: node.id, object: node })).slice(0, 5),
      ...relations
        .map(({ relation }) => ({ type: "relation" as const, id: relation.id, object: relation }))
        .slice(0, 5),
    ];
  }, [
    hasFocus,
    editedSinceFocused,
    object.text,
    isLabellingRelation,
    graph,
    treeNode.object.id,
    treeNode.relationWithParent.id,
    relation.relationType.id,
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
    async (option: DropdownOption) => {
      try {
        switch (option.type) {
          case "relationType": {
            // update the relation type of the current relation
            await graph.updateRelation({
              relationId: relation.id,
              relationProps: { relationType: option.object },
              reverse: !option.isForward,
            });
            if (object instanceof GraphNode) {
              await graph.updateNode({ nodeId: object.id, nodeProps: { content: "" } });
              tree.setFocusedNode(pathToNodeStr);
            }
            break;
          }
          case "action": {
            switch (option.id) {
              case "create-new-node": {
                const newNode = await graph.addNode({ nodeProps: { content: object.text } });
                await treeNode.setObject(newNode);
                tree.setFocusedNode(treeNode.path);
                break;
              }
              default: {
                option satisfies never;
              }
            }
          }
          case "node": {
            const newObject = graph.getNodeOrThrow(option.id);
            await treeNode.setObject(newObject);
            tree.setFocusedNode(treeNode.path);
            break;
          }
          case "relation": {
            const newObject = graph.getRelationOrThrow(option.id);
            await treeNode.setObject(newObject);
            tree.setFocusedNode(treeNode.path);
            break;
          }
          default:
            option satisfies never;
        }
      } catch (e) {
        logger.error("Error selecting dropdown option", e);
      } finally {
        closeDropdown();
      }
    },
    [closeDropdown, graph, relation, object, tree, pathToNodeStr, treeNode],
  );

  // Register keyboard commands for the dropdown
  useEffect(() => {
    return mergeRegister(
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
            event.preventDefault();
            event.stopPropagation();
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
            event.preventDefault();
            event.stopPropagation();
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
            event.stopPropagation();
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
          event.preventDefault();
          event.stopPropagation();
          closeDropdown();
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      // Track focus and text changes after focus
      editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          setHasFocus(true);
          setEditedSinceFocused(false);
          setTextOnFocus(editor.getEditorState().read(() => $getTextContent()));
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerTextContentListener((text) => {
        if (hasFocus && text !== textOnFocus) {
          setEditedSinceFocused(true);
        }
      }),
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
    hasFocus,
    textOnFocus,
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
    <div className={styles.DropdownContainer}>
      {objectsMatchingSearch.map((option, i) => {
        return (
          <div
            key={option.id}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(option);
            }}
            onMouseEnter={() => mouseHasMoved && setSelected(option.id)}
            className={cn(styles.DropdownItem, i === selectedIdx && styles.Selected)}
          >
            {option.type === "action" && option.id === "create-new-node" ? (
              `Create new node "${object.text}"`
            ) : option.type === "node" ? (
              option.object.text
            ) : option.type === "relationType" ? (
              <span>{option.isForward ? option.object.label : option.object.reverseLabel}:</span>
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
