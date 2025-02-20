import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_NORMAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  ParagraphNode,
} from "lexical";
import { action } from "mobx";
import { useEffect, useMemo, useRef, useState } from "react";

import { Path } from "@/app/components/Path";
import { RelationCounter } from "@/app/components/RelatedObject/RelationCounter";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { $createParagraphMatchingGraphNode, graphNodeMatchesParagraph } from "@/app/editor/utils/content";
import { $getChipsAroundSelection } from "@/app/editor/utils/selection";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { GraphObject } from "@/app/graph/GraphObject";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { getCanonicalPath } from "@/app/graph/utils";
import { TreeNode } from "@/app/tree/nodes";
import { uuid } from "@/app/util";
import { cn, HASHTAG_SYMBOL } from "@/lib/utils";

import * as dropdownStyles from "./dropdown/DropdownPlugin.module.css";

type HashtagDropdownState = {
  searchText: string;
};

const HashtagDropdown = ({
  state,
  closeDropdown,
  selectMatch,
}: {
  state: HashtagDropdownState | null;
  closeDropdown: () => void;
  selectMatch: (match: GraphObject) => void;
}) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const mouseMoveSinceStateChange = useRef(false);

  const matches = useMemo(() => {
    // Check the matching
    return graphStore.myHashtagsNode.children.filter((c) => c.text.includes(state?.searchText ?? ""));
  }, [graphStore, state]);

  useEffect(() => {
    if (!state) return;
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
          const match = highlightedIndex !== null ? matches[highlightedIndex] : null;
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
          const match = matches[index];
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
          if (matches.length === 0) return false;
          event.preventDefault();
          event.stopPropagation();
          const nextIndex =
            highlightedIndex === null || highlightedIndex === matches.length - 1 ? 0 : highlightedIndex + 1;
          setHighlightedIndex(nextIndex);
          scrollToElement(nextIndex);
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (matches.length === 0) return false;
          event.preventDefault();
          event.stopPropagation();
          const nextIndex =
            highlightedIndex === null || highlightedIndex === 0 ? matches.length - 1 : highlightedIndex - 1;
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
  }, [editor, state, highlightedIndex, closeDropdown, selectMatch]);

  if (state === null) {
    return null;
  }

  return (
    <div ref={ref} className={cn(dropdownStyles.Dropdown, dropdownStyles.SearchAndReplace)}>
      <ul ref={listRef}>
        {matches.map((match, index) => (
          <li
            key={match.id}
            className={cn(
              highlightedIndex === index ? dropdownStyles.Selected : "",
              match.authorId !== graphStore.user.id ? dropdownStyles.NotOwned : "",
            )}
            onMouseEnter={() => mouseMoveSinceStateChange.current && setHighlightedIndex(index)}
            onClick={() => selectMatch(match)}
          >
            <div className={dropdownStyles.DropdownItem}>
              <div className={dropdownStyles.DropdownItemContent}>
                <div style={{ flex: 1, overflow: "hidden" }}>{match.text}</div>
                <div className={dropdownStyles.DropdownItemHelper}>
                  {index === 0 && highlightedIndex === null && (
                    <div className={dropdownStyles.DropdownHelper}>Tab to select </div>
                  )}

                  <RelationCounter object={match} showTooltip={false} />
                </div>
              </div>
              {<Path path={getCanonicalPath(match)} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Plugin to handle hashtag nodes
 */
export const HashtagPlugin = ({ treeNode }: { treeNode: TreeNode }) => {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  // Track whether we're creating a new hashtag so we can clean up if we select an existing hashtag instead
  const [newHashtagId, setNewHashtagId] = useState<string | null>(null);
  const [state, setState] = useState<HashtagDropdownState | null>(null);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      action((event) => {
        if (!event) return false;

        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const { chipsBefore } = $getChipsAroundSelection(selection);
        const previousChip = chipsBefore[chipsBefore.length - 1];

        if (event.key === HASHTAG_SYMBOL) {
          // Handle new hashtag creation
          event.preventDefault();

          const newNodeId = uuid();
          graphStore.addChildNode({
            parentId: graphStore.myHashtagsNodeId,
            nodeProps: { id: newNodeId, content: "#" },
            after: -1,
          });

          setState({ searchText: "#" });
          setNewHashtagId(newNodeId);

          $createMentionNode(newNodeId, "#", HASHTAG_SYMBOL);

          graphStore.addRelation({
            fromId: treeNode.object.id,
            toId: newNodeId,
            relationTypeId: graphStore.relationTypesById.relatedTo.id,
          });

          const { chipsAfter } = $getChipsAroundSelection(selection);
          const newContent: Chip[] = [
            ...chipsBefore,
            { type: "mention", value: newNodeId, mentionTrigger: HASHTAG_SYMBOL },
            ...chipsAfter,
          ];

          updateEditorContent(newContent);
          return true;
        } else if (
          !event.ctrlKey &&
          !event.metaKey &&
          event.key.length === 1 &&
          /[a-zA-Z0-9*()[\]{}|\\/<>,.!@#$%^&+=;:'"`~?-]/.test(event.key) &&
          previousChip?.type === "mention" &&
          previousChip.mentionTrigger === HASHTAG_SYMBOL
        ) {
          // Handle typing after a hashtag - update the hashtag node's content
          event.preventDefault();

          const hashtagNodeId = previousChip.value;
          const existingNode = graphStore.getNode(hashtagNodeId);
          if (!existingNode) return false;

          const newContent: Chip[] = [...existingNode.content, { type: "text", value: event.key }];
          graphStore.updateNode({
            nodeId: hashtagNodeId,
            nodeProps: { content: newContent },
          });

          setState({ searchText: existingNode.text });
          // We have to manually force the editor update because from the editor's perspective nothing has changed here,
          // so it doesn't know that we've updated the hashtag node's content.
          editor.update(() => {
            const graphNode = treeNode.object as GraphNode;
            const currentParagraph = $getRoot().getChildren()[0] as ParagraphNode;
            if (graphNodeMatchesParagraph(graphNode, currentParagraph, graphStore)) {
              return;
            }
            const newParagraph = $createParagraphMatchingGraphNode(graphNode, graphStore);
            currentParagraph.replace(newParagraph);
          });
          return true;
        } else if (
          state !== null &&
          (event.key === "Escape" ||
            event.key === "Enter" ||
            event.key === "Tab" ||
            event.key === "ArrowUp" ||
            event.key === "ArrowDown")
        ) {
          // Don't interfere with the dropdown keypress
          return false;
        }

        // Close the dropdown on any other interactions
        setState(null);
        return false;
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor, graphStore, treeNode]);

  // Helper function to update editor content and move cursor
  const updateEditorContent = (newContent: Chip[]) => {
    const graphNode = treeNode.object;
    graphStore.updateNode({ nodeId: graphNode.id, nodeProps: { content: newContent } }).then(() => {
      const sel = treeNode.tree.selection;
      if (sel?.type !== "editor") return;
      if (sel.position === "start" || sel.position === "end") return;
      const newOffset = Math.min(sel.position.anchorOffset, sel.position.focusOffset) + 1;
      treeNode.tree.setFocusedNode(treeNode.id, { anchorOffset: newOffset, focusOffset: newOffset });
    });
  };

  // Handle selecting a hashtag
  const selectMatch = (match: GraphObject) => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    const { chipsBefore, chipsAfter } = $getChipsAroundSelection(selection);
    const previousChip = chipsBefore[chipsBefore.length - 1];

    const txns: TxCombined = [];

    if (previousChip?.type === "mention" && previousChip.mentionTrigger === HASHTAG_SYMBOL) {
      const newContent: Chip[] = [
        ...chipsBefore.slice(0, -1),
        { type: "mention", value: match.id, mentionTrigger: HASHTAG_SYMBOL },
        ...chipsAfter,
      ];

      txns.push({
        type: "updateNode",
        transaction: { nodeId: treeNode.object.id, nodeProps: { content: newContent } },
      });
    }

    // Delete the temporary hashtag node if we created one
    if (newHashtagId) {
      txns.push({
        type: "removeNode",
        transaction: { nodeId: newHashtagId },
      });
    }

    graphStore.applyCombinedTransaction(txns);

    // Close the dropdown
    setState(null);
  };

  return <HashtagDropdown state={state} closeDropdown={() => setState(null)} selectMatch={selectMatch} />;
};
