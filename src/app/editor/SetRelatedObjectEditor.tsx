import { useViewController } from "@/app/controller/useViewController";
import { KeyboardOverridesPlugin } from "@/app/editor/plugins/KeyboardOverridesPlugin";
import { createContentMatchingParagraph, graphNodeMatchesParagraph } from "@/app/editor/plugins/SyncWithGraphPlugin";
import { ViewControllerRegistryPlugin } from "@/app/editor/plugins/ViewControllerRegistryPlugin";
import { Chip, GraphNode } from "@/app/model/GraphNode";
import { GraphRelation } from "@/app/model/GraphRelation";
import { $createMentionNode } from "@/app/model/MentionNode";
import { relationsToPathStr } from "@/app/util";
import { cn } from "@/lib/utils";
import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { InitialConfigType, LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $setSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  EditorState,
  FOCUS_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_SPACE_COMMAND,
  LexicalEditor,
  ParagraphNode,
} from "lexical";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRelationAtPath } from "../components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "../store/useGraphStore";

/**
 * SetRelatedObjectEditor
 *
 * An editor which:
 * - Presents a text representation of the current related object
 * - On edit, replaces the related object with the first one that matches the
 *   new editor text (or creates a new one if none match).
 *
 * **Note:** Edits don't change the content of the related object, but rather
 * replace which object is related.
 */
export const SetRelatedObjectEditor = observer(() => {
  const graphStore = useGraphStore();
  const { object, relation, pathToNodeStr, pathToParentWithOrderedObjects } = useRelationAtPath();
  const ref = useRef<HTMLInputElement>(null);
  const initialConfig = useMemo<InitialConfigType>(() => {
    return {
      namespace: "SearchOrCreateEditor",
      onError: () => {},
      editorState: () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode(object.text);
        paragraph.append(text);
        $getRoot().append(paragraph);
      },
    };
  }, [object.text]);

  // TODO 1) duplicate and 2) needing to special case the outline root feels wrong
  const root = pathToParentWithOrderedObjects[0].child;
  const underline =
    root.id === graphStore.outlineRoot.id &&
    object.relations.some(
      (r) => r.to.id === object.id && r.id !== relation.id && r.from.id !== graphStore.thoughtstreamRoot.id,
    );

  return (
    <div
      ref={ref}
      className={cn("flex flex-col relative w-full")}
      style={{
        color: underline ? "var(--gray-12)" : undefined,
        textDecoration: underline ? "underline  var(--teal-9)" : undefined,
      }}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={<ContentEditable className="outline-none" data-nodeid={object.id} />}
          placeholder={null}
        />
        <SetEditorContentToRelatedObjectTextPlugin />
        <ReplaceRelatedObjectOnEditorChangePlugin />
        <DropdownPlugin parentRef={ref} />
        <SplitOnEnterPlugin />
        <SetRelationTypeOnColonPlugin />
        <IgnoreSpaceAtStartOfLabelledRelationsPlugin />
        <HistoryPlugin />
        <KeyboardOverridesPlugin />
        <ClearEditorPlugin />
        <ViewControllerRegistryPlugin pathToNodeStr={pathToNodeStr} />
      </LexicalComposer>
    </div>
  );
});

/**
 * Ignore space at the start of the editor.
 *
 */
const IgnoreSpaceAtStartOfLabelledRelationsPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { isChild } = useRelationAtPath();
  useEffect(() => {
    if (isChild) return;
    return editor.registerCommand(
      KEY_SPACE_COMMAND,
      (event) => {
        const text = $getRoot().getTextContent();
        if (text.trim() === "") {
          event.preventDefault();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, isChild]);
  return null;
};

const SetRelationTypeOnColonPlugin = () => {
  const graph = useGraphStore();
  const viewController = useViewController();
  const { object, relation, pathToNodeStr } = useRelationAtPath();
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event, editor) => {
        if (event.key === ":") {
          const isChild = relation.relationType.id === graph.relationTypesById.child.id && relation.to.id === object.id;
          if (!isChild) {
            return false;
          }

          // Get editor text and selection
          const textAndSelection = editor.getEditorState().read(() => {
            const points = $getSelection()?.getStartEndPoints();
            if (!points) return null;
            const [anchor, focus] = points;
            const [start, end] = [anchor.offset, focus.offset].sort((a, b) => a - b);
            const editorText = $getRoot().getTextContent();
            return {
              start,
              end,
              editorText,
            };
          });
          if (!textAndSelection) {
            return false;
          }

          // If there's a colon before the selection, don't do anything
          const { start, end, editorText } = textAndSelection;
          const textBeforeSelection = editorText.slice(0, start).trim();
          if (textBeforeSelection.includes(":")) {
            return false;
          }

          // Set relation type to the text before the selection
          const relationType = graph.getOrCreateRelationTypeByLabel(textBeforeSelection);
          relation.setType(relationType);

          // Set the editor text to the text after the selection end to the end of the text
          setEditorToContent(editor, editorText.slice(end));
          // TODO somehow get rid of need for this
          // setDropdownOpen(false);
          viewController.setFocusedNode(pathToNodeStr);

          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, graph, object, relation, viewController, pathToNodeStr]);

  return null;
};

type DropdownOption =
  | { type: "node"; id: string; object: GraphNode }
  | { type: "relation"; id: string; object: GraphRelation }
  | { type: "action"; id: "create-new-node" };

const DropdownPlugin = ({ parentRef }: { parentRef: React.RefObject<HTMLDivElement> }) => {
  const graph = useGraphStore();
  const viewController = useViewController();
  const { object, relation, pathToParentRelations, pathToNodeStr } = useRelationAtPath();
  const [editor] = useLexicalComposerContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hasFocus, setHasFocus] = useState(editor.getRootElement()?.contains(document.activeElement) ?? false);

  // If the user clicks anywhere that's not the input or dropdown, close the dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (parentRef.current && !parentRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [parentRef]);

  // Filter nodes that match the search
  const objectsMatchingSearch = useMemo(() => {
    const keywords = object.text.split(/\s+/);
    const nodeOptions: DropdownOption[] = graph.nodes
      .filter(
        (node) =>
          node.id !== object.id && keywords.every((keyword) => node.text.toLowerCase().includes(keyword.toLowerCase())),
      )
      .map((node) => ({ type: "node", id: node.id, object: node }));
    const relationOptions: DropdownOption[] = graph.relations
      .filter(
        (r) =>
          r.id !== object.id &&
          r.id !== relation.id &&
          keywords.every((keyword) => r.text.toLowerCase().includes(keyword.toLowerCase())),
      )
      .map((relation) => ({ type: "relation", id: relation.id, object: relation }));
    const actionOptions: DropdownOption[] =
      object.relations.length > 1 ? [{ type: "action", id: "create-new-node" }] : [];
    return [...nodeOptions, ...relationOptions, ...actionOptions];
  }, [graph.nodes, graph.relations, object.id, object.text, relation.id, object.relations]);

  // Select a node from the dropdown
  const onSelect = useCallback(
    (option: DropdownOption) => {
      const newObject: GraphNode | GraphRelation =
        option.type === "action" && option.id === "create-new-node"
          ? graph.createNode({ content: object.text })
          : option.object;
      graph.setGraphNodeAtPath([...pathToParentRelations, relation], newObject);
      viewController.setFocusedNode(pathToNodeStr);
      setDropdownOpen(false);
    },
    [graph, pathToParentRelations, relation, viewController, pathToNodeStr, object.text],
  );

  // Register keyboard commands for the dropdown
  useEffect(() => {
    const unsubscribe = mergeRegister(
      editor.registerCommand<KeyboardEvent>(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (dropdownOpen && objectsMatchingSearch.length > 0) {
            if (selected === null) {
              setSelected(objectsMatchingSearch[0].id ?? null);
            } else {
              const selectedIdx = objectsMatchingSearch.findIndex((o) => o.id === selected);
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
              const selectedIdx = objectsMatchingSearch.findIndex((o) => o.id === selected);
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
            const option = objectsMatchingSearch.find((o) => o.id === selected);
            if (option) {
              onSelect(option);
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
          setDropdownOpen(false);
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
  }, [editor, dropdownOpen, setDropdownOpen, objectsMatchingSearch, selected, setSelected, onSelect]);

  // Open the dropdown when the text content changes while the editor is focused
  useEffect(() => {
    const unsubscribe = editor.registerTextContentListener((text) => {
      if (hasFocus && text !== object.text) {
        setDropdownOpen(true);
      }
    });
    return unsubscribe;
  }, [editor, object.text, hasFocus]);

  return hasFocus && dropdownOpen && objectsMatchingSearch.length > 0 ? (
    <div className="absolute top-6 left-0 w-full bg-white border border-gray-300 z-10">
      {objectsMatchingSearch.map((option, i) => (
        <div
          key={option.id}
          onClick={() => onSelect(option)}
          onMouseEnter={() => setSelected(option.id)}
          className={cn(selected === option.id ? "bg-gray-200" : "")}
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
      ))}
    </div>
  ) : null;
};

/**
 * - Set the content of the editor to the text up to the selection start
 * - Create a new node below, using the text after the selection end
 */
const SplitOnEnterPlugin = () => {
  const graph = useGraphStore();
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  const { parent, object, relation, pathToParentRelations, pathToParentWithOrderedObjects } = useRelationAtPath();
  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_ENTER_COMMAND,
      () => {
        const points = $getSelection()?.getStartEndPoints();
        if (!points) return false;
        const [start, end] = [points[0].offset, points[1].offset].sort((a, b) => a - b);
        const editorText = $getRoot().getTextContent();
        const textBeforeSelection = editorText.slice(0, start);
        const textAfterSelection = editorText.slice(end);
        // set editor text to text after selection
        setEditorToContent(editor, textBeforeSelection);
        // create new node below
        const child = graph.createChildNode(parent, { content: textAfterSelection });
        const relationList = graph.getRelationList(parent);
        relationList.move([child.relation], relation);
        // set focused node to new node
        viewController.setFocusedNode(relationsToPathStr([...pathToParentRelations, child.relation]));
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, graph, parent, object, relation, pathToParentRelations, pathToParentWithOrderedObjects, viewController]);
  return null;
};

/**
 * Set the content of the editor to match the text of the related object
 */
const SetEditorContentToRelatedObjectTextPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { object } = useRelationAtPath();
  const setEditorContentToGraphNode = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        if (object.text !== $getRoot().getTextContent()) {
          setEditorToContent(editor, object.text);
        }
      });
    },
    [object.text, editor],
  );
  useEffect(() => {
    setEditorContentToGraphNode(editor.getEditorState());
  }, [editor, setEditorContentToGraphNode]);
  return null;
};

/**
 * When the editor content changes, replace the related graph object with the first
 * one matching the new content (or create a new one if none match)
 */
const ReplaceRelatedObjectOnEditorChangePlugin = () => {
  const graph = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const { object, relation, pathToParentRelations } = useRelationAtPath();

  useEffect(() => {
    const setRelatedObjectToMatchEditorContent = (editorState: EditorState) => {
      editorState.read(() => {
        const paragraph = $getRoot().getChildren()[0] as ParagraphNode;
        if (paragraph.getTextContent() === object.text) {
          return;
        }
        let newNode = graph.nodes.find((n) => n.text !== "" && graphNodeMatchesParagraph(n, paragraph, graph));
        if (!newNode) {
          newNode = graph.createNode({ content: createContentMatchingParagraph(paragraph) });
        }
        graph.setGraphNodeAtPath([...pathToParentRelations, relation], newNode);
        // If the node has no relations, or is only related to the thoughtstream, delete it
        if (
          object.relations.length === 0 ||
          object.relations.every((r) => {
            const other = r.from.id === object.id ? r.to : r.from;
            return other.id === graph.thoughtstreamRoot.id;
          })
        ) {
          graph.deleteNode(object.id);
        }
      });
    };
    const unsubscribe = editor.registerUpdateListener(({ editorState }) => {
      setRelatedObjectToMatchEditorContent(editorState);
    });
    return unsubscribe;
  }, [object, relation, pathToParentRelations, graph, editor]);

  return null;
};

// TODO share with setEditorToGraphNodeText
const setEditorToContent = (editor: LexicalEditor, content: Chip[] | string) => {
  const chips: Chip[] = typeof content === "string" ? [{ type: "text", value: content }] : content;
  editor.update(() => {
    const root = $getRoot();
    const paragraph = $createParagraphNode();
    chips.forEach((chip) => {
      if (chip.type == "mention") {
        // const mentionNodeText = graphStore.getNode(chip.value)?.text || "";
        const mentionNodeText = "";
        paragraph.append($createMentionNode(chip.value, mentionNodeText));
      } else {
        paragraph.append($createTextNode(chip.value));
      }
    });
    root.getChildren()[0].replace(paragraph);
    /**
     * Setting the selection to null here seems to prevent the error below.
     * Based on https://stackoverflow.com/a/72197580, it seems that when we're
     * updating the editor state on a non-focused editor, a new selection is
     * automatically set in the new editor state, and then the editor takes
     * the dom selection away from the user, leading to other downstream issues.
     *
     * ```
     * Error: updateEditor: selection has been lost because the previously
     * selected nodes have been removed and selection wasn't moved to
     * another node. Ensure selection changes after removing/replacing a
     * selected node.
     * ```
     */
    $setSelection(null);
  });
};
