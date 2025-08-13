import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_HIGH, TextNode } from "lexical";
import { ReactPortal, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom";

import LineLoader from "@/app/components/LineLoader/LineLoader";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { TreeNode } from "@/app/tree/nodes";
import { NotificationManager, uuid } from "@/app/util";
import {
  CONNECTION_SYMBOL,
  CONNECTION_SYMBOL_WITH_SPACE,
  DOUBLE_BRACKET,
  HASHTAG_SYMBOL,
  MENTION_SYMBOL,
  MenuTextMatch,
  TILDE_SYMBOL,
  cn,
  isMac,
} from "@/lib/utils";

import { DropdownItem } from "./DropdownItem";
import { LexicalTypeaheadMenuPlugin, MenuOption, MenuRenderFn } from "./LexicalTypeaheadPlugin";
import { Dropdown } from "./types";

import styles from "./DropdownPlugin.module.css";

/**
 * Much of the mentions implementation is copied from:
 * https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/MentionsPlugin/index.tsx#L23
 */
export function MentionDropdown({
  treeNode,
  triggerFn,
  dropdown,
}: {
  treeNode: TreeNode;
  triggerFn: (text: string) => MenuTextMatch | null;
  dropdown: Dropdown;
}) {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const tree = treeNode.tree;

  const options = useMemo(() => {
    let isHashtagWithExactMatch = false;
    if (
      dropdown?.type === "mention" &&
      dropdown.mentionTrigger === HASHTAG_SYMBOL &&
      dropdown.matches.some((o) => o.type === "node" && o.object.text === HASHTAG_SYMBOL + dropdown.search)
    ) {
      isHashtagWithExactMatch = true;
    }

    const sortedOptions =
      dropdown?.type === "mention"
        ? [
            ...dropdown.matches
              .filter((m) => m.type === "node")
              .map((m) => new MentionTypeaheadOption(m.object, dropdown.mentionTrigger))
              .slice(0, 10)
              .sort((a, b) => {
                // For hashtags, sort by:
                // exact match > number of relations in descending order
                if (dropdown.mentionTrigger === HASHTAG_SYMBOL) {
                  if (a.value.type !== "existing" || b.value.type !== "existing") {
                    return 0;
                  }
                  // Now we know both a and b are "existing" type
                  // Sort by exact match first..
                  if (a.value.object.text === "#" + dropdown.search && b.value.object.text !== "#" + dropdown.search) {
                    return -1;
                  }
                  if (a.value.object.text !== "#" + dropdown.search && b.value.object.text === "#" + dropdown.search) {
                    return 1;
                  }
                  // Then sort by number of relations in descending order
                  const aValue = a.value as { type: "existing"; object: GraphNode };
                  const bValue = b.value as { type: "existing"; object: GraphNode };
                  const aRelations = aValue.object.relations.length;
                  const bRelations = bValue.object.relations.length;
                  return bRelations - aRelations;
                }
                return 0;
              }),
            new MentionTypeaheadOption(dropdown.search, dropdown.mentionTrigger),
          ]
        : [];
    if (isHashtagWithExactMatch) {
      sortedOptions.splice(
        sortedOptions.findIndex((o) => o.value.type === "new"),
        1,
      );
    }
    return sortedOptions;
  }, [dropdown]);

  const onSelectOption = useCallback(
    async (opt: MentionTypeaheadOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      if (!nodeToReplace || !dropdown || dropdown.type !== "mention") return;
      // update editor
      const graphNodeId = opt.value.type === "new" ? uuid() : opt.value.object.id;
      const text = opt.value.type === "new" ? opt.value.text : opt.value.object.text;
      editor.update(async () => {
        const mentionNode = $createMentionNode(graphNodeId, text, dropdown.mentionTrigger);
        const currentNodeId = editor.getRootElement()?.getAttribute("data-nodeid");
        if (!currentNodeId) return;
        const currentObject = graphStore.getNode(currentNodeId);
        if (!currentObject) return;

        nodeToReplace.replace(mentionNode);
        let spaceAfter = new TextNode(" ");
        mentionNode.insertAfter(spaceAfter);

        if (
          dropdown.mentionTrigger === CONNECTION_SYMBOL ||
          dropdown.mentionTrigger === CONNECTION_SYMBOL_WITH_SPACE ||
          dropdown.mentionTrigger === TILDE_SYMBOL ||
          dropdown.mentionTrigger === DOUBLE_BRACKET
        ) {
          const connectionBefore = new TextNode(dropdown.mentionTrigger);
          mentionNode.insertBefore(connectionBefore);
        }
        spaceAfter.selectEnd();
        if (opt.value.type === "new") {
          let newNodeText = opt.name.slice("Create new node: ".length);
          if (dropdown.mentionTrigger === HASHTAG_SYMBOL) {
            newNodeText = opt.name.slice("Create new hashtag: ".length);
          }
          const newNodeIsHashtag = dropdown.mentionTrigger === HASHTAG_SYMBOL;
          const parentId = newNodeIsHashtag ? graphStore.myHashtagsNodeId : graphStore.userRootId;
          await graphStore.addChildNode({
            parentId: parentId,
            nodeProps: { id: graphNodeId, content: newNodeIsHashtag ? "#" + newNodeText : newNodeText },
            after: 0,
            relationProps: {
              relationTypeId: graphStore.relationTypesById.child.id,
            },
          });
        } else {
          if (opt.value.object.isUserNode) {
            const notificationManager = new NotificationManager();
            notificationManager.create({
              userId: opt.value.object.authorId,
              nodeId: currentNodeId,
            });
          }
        }
        closeMenu();
        // add relation
        if (dropdown.mentionTrigger === HASHTAG_SYMBOL) {
          const hasHashtagRelation = treeNode.object.relations.some(
            (r) =>
              r.relationType.id === defaultRelationTypes.hashtag.id &&
              r.from.id === treeNode.object.id &&
              r.to.id === graphNodeId,
          );
          if (!hasHashtagRelation) {
            await graphStore.addRelation({
              fromId: treeNode.object.id,
              toId: graphNodeId,
              relationTypeId: defaultRelationTypes.hashtag.id,
            });
          } else {
            //NOOP - The mention node isn't rendered without this.
            await graphStore.applyUpdates([]);
          }
        } else if (dropdown.mentionTrigger === DOUBLE_BRACKET) {
          // Double bracket mention has to and from relations flipped compared
          // to normal mention/parentRelation logic.
          const hasDoubleBracketRelation = treeNode.object.relations.some(
            (r) =>
              (r.relationType == defaultRelationTypes.relatedTo &&
                r.from.id === graphNodeId &&
                r.to.id === treeNode.object.id) ||
              (r.relationType.id === defaultRelationTypes.child.id &&
                r.to.id === treeNode.object.id &&
                r.from.id === graphNodeId),
          );
          if (!hasDoubleBracketRelation) {
            await graphStore.addRelation({
              fromId: graphNodeId,
              toId: treeNode.object.id,
              relationTypeId: graphStore.relationTypesById.relatedTo.id,
            });
          } else {
            //NOOP - The mention node isn't rendered without this.
            await graphStore.applyUpdates([]);
          }
        } else {
          const hasMentionOrParentRelation = treeNode.object.relations.some(
            (r) =>
              (r.relationType == defaultRelationTypes.relatedTo &&
                r.from == treeNode.object &&
                r.to.id === graphNodeId) ||
              (r.relationType.id === defaultRelationTypes.child.id &&
                r.to.id === treeNode.object.id &&
                r.from.id === graphNodeId),
          );

          if (!hasMentionOrParentRelation) {
            if (dropdown.mentionTrigger === TILDE_SYMBOL) {
              await graphStore.addRelation({
                fromId: treeNode.object.id,
                toId: graphNodeId,
                relationTypeId: defaultRelationTypes.author.id,
              });
            } else {
              await graphStore.addRelation({
                fromId: graphNodeId,
                toId: treeNode.object.id,
                relationTypeId:
                  dropdown.mentionTrigger === MENTION_SYMBOL
                    ? graphStore.relationTypesById.child.id
                    : graphStore.relationTypesById.relatedTo.id,
              });
            }
          } else {
            //NOOP - The mention node isn't rendered without this.
            await graphStore.applyUpdates([]);
          }
        }

        tree.setFocusedNode(treeNode.path, "end", true);
      });
    },
    [editor, tree, treeNode, graphStore, dropdown],
  );

  return (
    <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
      onQueryChange={() => {}}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={getMenuRenderFn(options)}
      // High priority so it takes precedence over the split on enter command
      commandPriority={COMMAND_PRIORITY_HIGH}
    />
  );
}

export class MentionTypeaheadOption extends MenuOption {
  value: { type: "existing"; object: GraphNode; trigger: string } | { type: "new"; text: string; trigger: string };
  constructor(value: GraphNode | string, trigger: string = "@") {
    super(typeof value === "string" ? value : value.id);
    this.value =
      typeof value === "string" ? { type: "new", text: value, trigger } : { type: "existing", object: value, trigger };
  }
  get name() {
    console.log("this.value.trigger", this.value.trigger);
    let createNewPrompt = this.value.trigger === HASHTAG_SYMBOL ? "Create new hashtag: " : "Create new node: ";
    return this.value.type === "new" ? createNewPrompt + this.value.text.trim() : this.value.object.text;
  }
}

export function getMenuRenderFn(
  options: MentionTypeaheadOption[],
  forCommandBar = false,
): MenuRenderFn<MentionTypeaheadOption> {
  return function MenuRenderFn(
    anchorElementRef,
    { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
  ): ReactPortal | JSX.Element | null {
    // Add ref to track if mouse has moved since dropdown appeared
    const mouseMoveSinceStateChange = useRef(false);
    // Store ref to the list element
    const ulRef = useRef<HTMLUListElement>(null);
    // State to track if the list has overflow
    const [hasOverflow, setHasOverflow] = useState(false);
    // State to track if scrolled to bottom
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

    // Check if list has overflow whenever options or selected index changes
    useEffect(() => {
      if (ulRef.current) {
        const hasScrollableContent = ulRef.current.scrollHeight > ulRef.current.clientHeight;
        setHasOverflow(hasScrollableContent);

        // Initially check if it's scrolled to bottom
        const isAtBottom =
          Math.abs(ulRef.current.scrollHeight - ulRef.current.scrollTop - ulRef.current.clientHeight) < 1;
        setIsScrolledToBottom(isAtBottom);
      }
    }, [options, selectedIndex]);

    // Add scroll event listener to track when user scrolls to bottom
    useEffect(() => {
      const listElement = ulRef.current;
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

    useEffect(() => {
      // Reset the flag when the options change
      mouseMoveSinceStateChange.current = false;

      // Add mouse move listener to detect when mouse moves
      const handleMouseMove = (event: MouseEvent) => {
        mouseMoveSinceStateChange.current = true;

        // If the mouse is already over the dropdown when it moves,
        // find which option it's hovering over and highlight it
        if (ulRef.current) {
          const listItems = ulRef.current.querySelectorAll("li");
          listItems.forEach((item, index) => {
            const rect = item.getBoundingClientRect();
            if (
              event.clientX >= rect.left &&
              event.clientX <= rect.right &&
              event.clientY >= rect.top &&
              event.clientY <= rect.bottom
            ) {
              setHighlightedIndex(index);
            }
          });
        }
      };

      document.addEventListener("mousemove", handleMouseMove);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
      };
    }, [setHighlightedIndex]);

    const Menu = (
      <div className={cn(styles.Dropdown, styles.TypeaheadPopover, forCommandBar && styles.ForCommandBar)}>
        <LineLoader height={2} />
        <ul ref={ulRef}>
          {options.map((option, i: number) =>
            option.value.type === "new" ? (
              <li
                key={option.key}
                tabIndex={-1}
                className={selectedIndex === i ? styles.Selected : ""}
                ref={option.setRefElement}
                id={"typeahead-item-" + i}
                onMouseEnter={() => {
                  // Only set highlighted index if mouse has moved since dropdown appeared
                  if (mouseMoveSinceStateChange.current) {
                    setHighlightedIndex(i);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setHighlightedIndex(i);
                  selectOptionAndCleanUp(option);
                }}
              >
                <div className={styles.DropdownItem}>
                  {option.value.trigger === HASHTAG_SYMBOL
                    ? `Create new hashtag: ${option.value.text.trim()}`
                    : `Create new node: ${option.value.text.trim()}`}
                  {option.value.type === "new" && ` (${isMac ? "⌘" : "Ctrl"} + Enter )`}
                </div>
              </li>
            ) : (
              <DropdownItem
                key={option.key}
                index={i}
                ref={option.setRefElement}
                isSelected={selectedIndex === i}
                onMouseEnter={() => {
                  // Only set highlighted index if mouse has moved since dropdown appeared
                  if (mouseMoveSinceStateChange.current) {
                    setHighlightedIndex(i);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setHighlightedIndex(i);
                  selectOptionAndCleanUp(option);
                }}
                match={{
                  key: option.key,
                  type: "node",
                  object: option.value.object,
                  score: 0,
                }}
              />
            ),
          )}
        </ul>
        {hasOverflow && !isScrolledToBottom && <div className={styles.BottomGradient} />}
      </div>
    );

    if (!anchorElementRef.current || !options.length) {
      return null;
    }

    return ReactDOM.createPortal(Menu, anchorElementRef.current);
  };
}
