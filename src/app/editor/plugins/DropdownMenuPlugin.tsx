import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalTypeaheadMenuPlugin } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { COMMAND_PRIORITY_HIGH, TextNode } from "lexical";
import { useCallback, useRef, useState } from "react";

import {
  ActionId,
  DropdownOption,
  DropdownOptionType,
  filterAndSortOptions,
  getMentionSearchResults,
  getMenuRenderFn,
  getSearchAndReplaceResults,
} from "@/app/components/UIPrimitives/DropdownMenuUtils";
import { GraphNode } from "@/app/graph/GraphNode";
import { defaultRelationTypes } from "@/app/graph/GraphStore";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { uuid } from "@/app/util";
import logger from "@/lib/logger";
import { checkForMentionMatch, checkForSearchAndReplaceMatch } from "@/lib/utils";
const SUGGESTION_LIST_LENGTH_LIMIT = 5;

export function DropdownMenuPlugin({ treeNode }: { treeNode: DescendantTreeNode | RootTreeNode }): JSX.Element | null {
  const node = treeNode.object;
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const object = treeNode.object;
  const tree = useTree();
  const relation = treeNode.relationWithParent;
  const isLabellingRelation = relation?.isLabelled() ?? false;
  const { searchAndReplaceDropdown } = useSettingsStore();

  const prevText = useRef<string | null>(null);

  const [options, setOptions] = useState<DropdownOption[]>([]);
  const limitedOptions = options.slice(0, SUGGESTION_LIST_LENGTH_LIMIT);
  const [isOnSelectOptionMention, setIsOnSelectOptionMention] = useState(true);
  const allOptions = isOnSelectOptionMention
    ? [...limitedOptions, new DropdownOption(ActionId.CREATE_NEW_NODE)]
    : limitedOptions;

  const onMention = useCallback(
    async (opt: DropdownOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      if (!nodeToReplace) return;
      // update editor
      const graphNodeId = opt.value.type === DropdownOptionType.ACTION ? uuid() : opt.value.object.id;
      const mentionText = nodeToReplace.getTextContent().slice(1); // Remove the '@' symbol
      editor.update(async () => {
        const mentionNode = $createMentionNode(graphNodeId, mentionText);
        nodeToReplace.replace(mentionNode);
        mentionNode.selectEnd();
        if (opt.value.type === DropdownOptionType.ACTION) {
          await graphStore.addChildNode({
            parentId: graphStore.outlineRoot.id,
            nodeProps: { id: graphNodeId, content: mentionText },
          });
        }
        // add relation
        const hasMentionRelation = node.relations.some(
          (r) => r.relationType === defaultRelationTypes.child && r.from === node && r.to.id === graphNodeId,
        );
        if (!hasMentionRelation) {
          await graphStore.addRelation({
            fromId: graphNodeId,
            toId: node.id,
            relationType: defaultRelationTypes.child,
          });
        }
        closeMenu();
      });
    },
    [editor, node, graphStore],
  );

  const onSearchAndReplace = useCallback(
    async (option: DropdownOption) => {
      console.log("HERE");
      try {
        switch (option.value.type) {
          case DropdownOptionType.RELATION_TYPE: {
            // update the relation type of the current relation
            if (relation) {
              await graphStore.updateRelation({
                relationId: relation.id,
                relationProps: { relationType: option.value.object },
                reverse: !option.value.isForward,
              });
            }
            if (object instanceof GraphNode) {
              graphStore.updateNode({ nodeId: object.id, nodeProps: { content: "" } });
              tree.setFocusedNode(treeNode.path);
            }
            break;
          }
          case DropdownOptionType.ACTION: {
            switch (option.value.id) {
              case ActionId.CREATE_NEW_NODE: {
                const newNode = await graphStore.addNode({ nodeProps: { content: object.text } });
                if (treeNode instanceof DescendantTreeNode) {
                  await treeNode.setObject(newNode);
                } else if (treeNode instanceof RootTreeNode) {
                  treeNode.object = newNode;
                  tree.setFocusedNode(treeNode.path);
                }
                tree.setFocusedNode(treeNode.path);
                break;
              }
              default: {
                option.value.id satisfies never;
              }
            }
            break;
          }
          case DropdownOptionType.NODE: {
            const newObject = graphStore.getNodeOrThrow(option.value.object.id);
            if (treeNode instanceof DescendantTreeNode) {
              await treeNode.setObject(newObject);
            } else if (treeNode instanceof RootTreeNode) {
              treeNode.object = newObject;
            }
            tree.setFocusedNode(treeNode.path);
            break;
          }
          case DropdownOptionType.RELATION: {
            const newObject = graphStore.getRelationOrThrow(option.value.object.id);
            if (treeNode instanceof DescendantTreeNode) {
              await treeNode.setObject(newObject);
            } else if (treeNode instanceof RootTreeNode) {
              treeNode.object = newObject;
            }
            tree.setFocusedNode(treeNode.path);
            break;
          }
          default:
            option.value satisfies never;
        }
      } catch (e) {
        logger.error("Error selecting dropdown option", e);
      } finally {
      }
    },
    [graphStore, relation, object, tree, treeNode],
  );

  const menuRenderFn = getMenuRenderFn(allOptions, prevText.current ?? "");

  return (
    <LexicalTypeaheadMenuPlugin<DropdownOption>
      onQueryChange={() => {}}
      onSelectOption={isOnSelectOptionMention ? onMention : onSearchAndReplace}
      triggerFn={(text) => {
        const mentionMatch = checkForMentionMatch(text);
        const searchAndReplaceMatch = checkForSearchAndReplaceMatch(
          text,
          isLabellingRelation,
          searchAndReplaceDropdown,
        );

        if (mentionMatch) {
          setIsOnSelectOptionMention(true);
        } else if (searchAndReplaceMatch) {
          setIsOnSelectOptionMention(false);
        }

        const match = mentionMatch ?? searchAndReplaceMatch;
        if (match && match.matchingString.length > 0) {
          const queryString = match.matchingString.toLocaleLowerCase();

          setOptions((prevOptions) => {
            if (prevOptions.length > 0 && prevText.current && text.startsWith(prevText.current)) {
              prevText.current = text;
              // If we've just added to the query, we can filter the existing options
              return filterAndSortOptions(prevOptions, queryString);
            } else {
              prevText.current = text;
              // Otherwise, we need to search the graph
              if (mentionMatch) {
                return getMentionSearchResults(graphStore, queryString, treeNode.object.id);
              }
              return getSearchAndReplaceResults(
                graphStore,
                queryString,
                isLabellingRelation,
                treeNode.object.id,
                treeNode.relationWithParent?.id,
                relation?.relationType.id,
              );
            }
          });
        } else {
          setOptions([]);
        }
        return match;
      }}
      options={allOptions}
      menuRenderFn={menuRenderFn}
      // High priority so it takes precedence over the split on enterkeyPlugin
      // and same level as toggleEditable Plugin command (which lets the enter key event propogate to this plugin on opening the dropdown)
      commandPriority={COMMAND_PRIORITY_HIGH}
    />
  );
}
