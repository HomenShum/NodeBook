import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
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
import { TriggerType } from "@/app/components/UIPrimitives/LexicalMenu";
import { LexicalTypeaheadMenuPlugin } from "@/app/editor/plugins/LexicalTypeaheadMenuPlugin";
import { GraphNode } from "@/app/graph/GraphNode";
import { defaultRelationTypes } from "@/app/graph/GraphStore";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { SearchAndReplaceDropdownOption } from "@/app/graph/SettingsStore";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { uuid } from "@/app/util";
import logger from "@/lib/logger";
import { checkForMentionMatch, checkForSearchAndReplaceMatch } from "@/lib/utils";

const SUGGESTION_LIST_LENGTH_LIMIT = 5;

export function DropdownMenuPlugin({ treeNode }: { treeNode: DescendantTreeNode | RootTreeNode }): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  const tree = useTree();
  const relation = treeNode.relationWithParent;
  const isLabellingRelation = relation?.isLabelled() ?? false;
  const { searchAndReplaceDropdown } = useSettingsStore();
  const [searchAndReplaceSetting, setSearchAndReplaceSetting] =
    useState<SearchAndReplaceDropdownOption>(searchAndReplaceDropdown);

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
            parentId: graphStore.userRoot.id,
            nodeProps: { id: graphNodeId, content: mentionText },
          });
        }
        // add relation
        const hasMentionRelation = treeNode.object.relations.some(
          (r) => r.relationType === defaultRelationTypes.child && r.from === treeNode.object && r.to.id === graphNodeId,
        );
        if (!hasMentionRelation) {
          await graphStore.addRelation({
            fromId: graphNodeId,
            toId: treeNode.object.id,
            relationType: defaultRelationTypes.child,
          });
        }
        closeMenu();
      });
    },
    [editor, graphStore, treeNode],
  );

  const onSearchAndReplace = useCallback(
    async (option: DropdownOption, _: TextNode | null, closeMenu: () => void) => {
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
            if (treeNode.object instanceof GraphNode) {
              graphStore.updateNode({ nodeId: treeNode.object.id, nodeProps: { content: "" } });
              tree.setFocusedNode(treeNode.path);
            }
            break;
          }
          case DropdownOptionType.ACTION: {
            switch (option.value.id) {
              case ActionId.CREATE_NEW_NODE: {
                const newNode = await graphStore.addNode({ nodeProps: { content: treeNode.object.text } });
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
                option.value as never satisfies never;
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
            option as never satisfies never;
        }
      } catch (e) {
        logger.error("Error selecting dropdown option", e);
      } finally {
        closeMenu();
      }
    },
    [graphStore, relation, tree, treeNode],
  );
  const [showMenu, setShowMenu] = useState(true);
  const menuRenderFn = getMenuRenderFn(allOptions, prevText.current ?? "", showMenu, setShowMenu);

  const handleRecentNodes = useCallback(() => {
    const nodeValues = Array.from(graphStore.nodesById.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .filter((node) => node.id !== treeNode.object.id && node.text != "My Graph" && node.text.length > 0);
    return nodeValues.slice(0, 5).map((node) => new DropdownOption(node));
  }, [graphStore, treeNode]);

  const updateOptions = useCallback(
    (text: string, queryString: string, isMentionMatch: boolean) => {
      setOptions((prevOptions) => {
        if (prevOptions.length > 0 && prevText.current && text.startsWith(prevText.current)) {
          prevText.current = text;
          return filterAndSortOptions(prevOptions, queryString);
        } else {
          prevText.current = text;
          if (isMentionMatch) {
            return getMentionSearchResults(graphStore, queryString, treeNode.object.id);
          }
          return getSearchAndReplaceResults(
            graphStore,
            queryString,
            isLabellingRelation,
            treeNode.object.id,
            treeNode.relationWithParent?.id,
            treeNode.relationWithParent?.relationType?.id,
          );
        }
      });
    },
    [graphStore, treeNode, isLabellingRelation],
  );

  const triggerFn = useCallback(
    (text: string, trigger: TriggerType = TriggerType.SHOW_MATCHING_TEXT) => {
      // Handle semicolon trigger for recently created nodes
      if (trigger === TriggerType.SHOW_RECENTLY_CREATED) {
        setOptions(handleRecentNodes());
        // Toggle search and replace options visibility
        if (searchAndReplaceSetting !== searchAndReplaceDropdown) {
          setSearchAndReplaceSetting(searchAndReplaceDropdown);
          return null;
        } else {
          setSearchAndReplaceSetting(SearchAndReplaceDropdownOption.Always);
          return checkForSearchAndReplaceMatch(";", isLabellingRelation, SearchAndReplaceDropdownOption.Always);
        }
      }

      const mentionMatch = checkForMentionMatch(text);
      const searchAndReplaceMatch = checkForSearchAndReplaceMatch(text, isLabellingRelation, searchAndReplaceSetting);

      if (mentionMatch) {
        setIsOnSelectOptionMention(true);
      } else if (searchAndReplaceMatch) {
        setIsOnSelectOptionMention(false);
      }

      const match = mentionMatch ?? searchAndReplaceMatch;
      if (match && match.matchingString.length > 0) {
        const queryString = match.matchingString.toLowerCase();
        updateOptions(text, queryString, !!mentionMatch);
      } else {
        setOptions([]);
      }
      return match;
    },
    [isLabellingRelation, searchAndReplaceSetting, handleRecentNodes, updateOptions, searchAndReplaceDropdown],
  );

  return (
    <LexicalTypeaheadMenuPlugin<DropdownOption>
      onQueryChange={() => {}}
      onSelectOption={isOnSelectOptionMention ? onMention : onSearchAndReplace}
      triggerFn={triggerFn}
      options={allOptions}
      menuRenderFn={menuRenderFn}
      isMenuOpen={showMenu}
      // High priority so it takes precedence over the split on enterkeyPlugin
      // and same level as toggleEditable Plugin command (which lets the enter key event propogate to this plugin on opening the dropdown)
      commandPriority={COMMAND_PRIORITY_HIGH}
    />
  );
}
