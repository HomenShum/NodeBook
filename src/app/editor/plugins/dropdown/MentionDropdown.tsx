import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_HIGH, KEY_SPACE_COMMAND, TextNode } from "lexical";
import { ReactPortal, useCallback, useEffect } from "react";
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

  // Register space key handler
  useEffect(() => {
    return editor.registerCommand(
      KEY_SPACE_COMMAND,
      (event: KeyboardEvent) => {
        if (!dropdown || dropdown.type !== "mention") {
          return false;
        }

        // If the mention dropdown is open in @ mode, we don't handle this
        if (dropdown.mentionTrigger === MENTION_SYMBOL) {
          return false;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        // Check for exact matches
        const exactMatches = dropdown.matches
          .filter((m) => {
            if (m.type !== "node") return false;
            const node = m.object as GraphNode;
            const nodeText = node.content?.map((c) => (c.type === "image" ? "" : c.value)).join("") || "";
            if (nodeText.startsWith(HASHTAG_SYMBOL)) {
              return nodeText.slice(1).toLowerCase() === dropdown.search.toLowerCase();
            }
            return nodeText.toLowerCase() === dropdown.search.toLowerCase();
          })
          .map((m) => m.object as GraphNode);

        if (exactMatches.length > 0) {
          // Sort by number of hashtag relations and take the most popular one
          const mostPopularMatch = exactMatches.sort((a, b) => {
            const aRelations = treeNode.object.relations.filter(
              (r) => r.relationType.id === defaultRelationTypes.hashtag.id && r.to.id === a.id,
            ).length;
            const bRelations = treeNode.object.relations.filter(
              (r) => r.relationType.id === defaultRelationTypes.hashtag.id && r.to.id === b.id,
            ).length;
            return bRelations - aRelations;
          })[0];

          // Link to the most popular exact match
          editor.update(async () => {
            const mentionNode = $createMentionNode(
              mostPopularMatch.id,
              mostPopularMatch.content?.toString() || "",
              dropdown.mentionTrigger,
            );
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            const textNode = selection.anchor.getNode();
            if (!textNode) return;

            textNode.replace(mentionNode);
            const spaceAfter = new TextNode(" ");
            mentionNode.insertAfter(spaceAfter);
            spaceAfter.selectEnd();

            // Add hashtag relation if it doesn't exist
            const hasHashtagRelation = treeNode.object.relations.some(
              (r) =>
                r.relationType.id === defaultRelationTypes.hashtag.id &&
                r.from.id === treeNode.object.id &&
                r.to.id === mostPopularMatch.id,
            );
            if (!hasHashtagRelation) {
              await graphStore.addRelation({
                fromId: treeNode.object.id,
                toId: mostPopularMatch.id,
                relationTypeId: defaultRelationTypes.hashtag.id,
              });
            } else {
              await graphStore.applyUpdates([]);
            }
          });
        } else {
          // No exact match, create new node as before
          const newNodeText = dropdown.search;
          const graphNodeId = uuid();
          editor.update(async () => {
            const mentionNode = $createMentionNode(graphNodeId, newNodeText, dropdown.mentionTrigger);
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            const textNode = selection.anchor.getNode();
            if (!textNode) return;

            textNode.replace(mentionNode);
            const spaceAfter = new TextNode(" ");
            mentionNode.insertAfter(spaceAfter);
            spaceAfter.selectEnd();

            const parentId = graphStore.myHashtagsNodeId;
            await graphStore.addChildNode({
              parentId: parentId,
              nodeProps: { id: graphNodeId, content: "#" + newNodeText },
              after: 0,
              relationProps: {
                relationTypeId: graphStore.relationTypesById.child.id,
              },
            });

            await graphStore.addRelation({
              fromId: treeNode.object.id,
              toId: graphNodeId,
              relationTypeId: defaultRelationTypes.hashtag.id,
            });
          });
        }

        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, dropdown, graphStore, treeNode]);

  const options =
    dropdown?.type === "mention"
      ? [
          ...dropdown.matches
            .filter((m) => m.type === "node")
            .map((m) => new MentionTypeaheadOption(m.object))
            .slice(0, 10)
            .sort((a, b) => {
              // For hashtags, sort by number of relations in descending order
              if (dropdown.mentionTrigger === HASHTAG_SYMBOL) {
                if (a.value.type !== "existing" || b.value.type !== "existing") {
                  return 0;
                }
                // Now we know both a and b are "existing" type
                const aValue = a.value as { type: "existing"; object: GraphNode };
                const bValue = b.value as { type: "existing"; object: GraphNode };
                const aRelations = aValue.object.relations.length;
                const bRelations = bValue.object.relations.length;
                return bRelations - aRelations;
              }
              return 0;
            }),
          new MentionTypeaheadOption(dropdown.search),
        ]
      : [];

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

        if (dropdown.mentionTrigger === DOUBLE_BRACKET) {
          spaceAfter = new TextNode("]] ");
        }

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
          const newNodeText = opt.name.slice("Create new node: ".length);
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
            await graphStore.addRelation({
              fromId: graphNodeId,
              toId: treeNode.object.id,
              relationTypeId:
                dropdown.mentionTrigger === MENTION_SYMBOL
                  ? graphStore.relationTypesById.child.id
                  : graphStore.relationTypesById.relatedTo.id,
            });
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
  value: { type: "existing"; object: GraphNode } | { type: "new"; text: string };
  constructor(value: GraphNode | string) {
    super(typeof value === "string" ? value : value.id);
    this.value = typeof value === "string" ? { type: "new", text: value } : { type: "existing", object: value };
  }
  get name() {
    return this.value.type === "new" ? `Create new node: ${this.value.text.trim()}` : this.value.object.text;
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
    const Menu = (
      <div className={cn(styles.Dropdown, styles.TypeaheadPopover, forCommandBar && styles.ForCommandBar)}>
        <LineLoader height={2} />
        <ul>
          {options.map((option, i: number) =>
            option.value.type === "new" ? (
              <li
                key={option.key}
                tabIndex={-1}
                className={selectedIndex === i ? styles.Selected : ""}
                ref={option.setRefElement}
                id={"typeahead-item-" + i}
                onMouseEnter={() => {
                  setHighlightedIndex(i);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setHighlightedIndex(i);
                  selectOptionAndCleanUp(option);
                }}
              >
                <div className={styles.DropdownItem}>
                  {`Create new node: ${option.value.text.trim()}`}
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
                  setHighlightedIndex(i);
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
      </div>
    );

    if (!anchorElementRef.current || !options.length) {
      return null;
    }

    return ReactDOM.createPortal(Menu, anchorElementRef.current);
  };
}
