import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { MenuResolution } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { COMMAND_PRIORITY_HIGH, TextNode } from "lexical";
import { RefObject, useCallback, useRef, useState } from "react";

import {
  ActionId,
  DropdownOption,
  DropdownOptionType,
  filterAndSortOptions,
  getMentionSearchResults,
  getMenuRenderFn,
  getSearchAndReplaceResults,
} from "@/app/components/UIPrimitives/DropdownMenuUtils";
import { MenuEventTrigger, MenuState } from "@/app/components/UIPrimitives/LexicalMenu";
import { LexicalTypeaheadMenuPlugin } from "@/app/editor/plugins/LexicalTypeaheadMenuPlugin";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { SearchAndReplaceDropdownOption } from "@/app/graph/SettingsStore";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { uuid } from "@/app/util";
import logger from "@/lib/logger";
import { checkForMentionMatch, checkForSearchAndReplaceMatch } from "@/lib/utils";

enum DropdownAction {
  NONE,
  MENTION,
  SEARCH_AND_REPLACE,
}

const SUGGESTION_LIST_LENGTH_LIMIT = 5;

export function DropdownMenuPlugin({
  treeNode,
  boundaryRef,
}: {
  treeNode: DescendantTreeNode | RootTreeNode;
  boundaryRef?: RefObject<HTMLDivElement>;
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  const tree = useTree();
  const relation = treeNode.relationWithParent;
  const isLabellingRelation = relation?.isLabelled() ?? false;
  const { searchAndReplaceDropdown } = useSettingsStore();
  const [searchAndReplaceSetting, setSearchAndReplaceSetting] =
    useState<SearchAndReplaceDropdownOption>(searchAndReplaceDropdown);

  const prevText = useRef<string | null>(null);
  const queryString = prevText.current ?? "";

  const [options, setOptions] = useState<DropdownOption[]>([]);
  const limitedOptions = options.slice(0, SUGGESTION_LIST_LENGTH_LIMIT);
  const [currentAction, setCurrentAction] = useState<DropdownAction>(DropdownAction.NONE);
  const allOptions =
    currentAction === DropdownAction.MENTION
      ? [...limitedOptions, new DropdownOption(ActionId.CREATE_NEW_NODE)]
      : limitedOptions;

  const [menuState, setMenuState] = useState<MenuState>({ isOpen: false, resolution: null });

  const onMention = useCallback(
    async (opt: DropdownOption, nodeToReplace: TextNode | null, closeMenu: () => void, _: string) => {
      if (!nodeToReplace) return;
      // update editor
      const graphNodeId = opt.value.type === DropdownOptionType.ACTION ? uuid() : opt.value.object.id;
      // Remove the '@' symbol
      const mentionText =
        opt.value.type === DropdownOptionType.ACTION
          ? nodeToReplace.getTextContent().slice(1)
          : graphStore.getNode(opt.value.object.id)?.text || "";
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
      tree.setFocusedNode(treeNode.id, undefined, undefined, true);
    },
    [editor, graphStore, tree, treeNode],
  );

  const onSearchAndReplace = useCallback(
    async (option: DropdownOption, _: TextNode | null, closeMenu: () => void, __: string) => {
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

  const handleRecentNodes = useCallback(() => {
    const nodeValues = Array.from(graphStore.nodesById.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .filter((node) => node.id !== treeNode.object.id && node.text != "My Graph" && node.text.length > 0);
    return nodeValues.slice(0, 5).map((node) => new DropdownOption(node));
  }, [graphStore, treeNode]);

  const updateOptions = useCallback(
    (fullText: string, matchingString: string, action: DropdownAction) => {
      setOptions((prevOptions) => {
        if (
          prevOptions.length > 0 &&
          (prevText.current?.length || 0) > 1 &&
          prevText.current &&
          fullText.startsWith(prevText.current)
        ) {
          prevText.current = fullText;
          return filterAndSortOptions(prevOptions, queryString);
        } else {
          if (action === DropdownAction.MENTION) {
            return getMentionSearchResults(graphStore, matchingString, treeNode.object.id);
          }
          return getSearchAndReplaceResults(
            graphStore,
            matchingString,
            isLabellingRelation,
            treeNode.object.id,
            treeNode.relationWithParent?.id,
            treeNode.relationWithParent?.relationType?.id,
          );
        }
      });
    },
    [graphStore, treeNode, isLabellingRelation, queryString],
  );

  const menuStateHandler = useCallback(
    (
      trigger: MenuEventTrigger = MenuEventTrigger.SHOW_MATCHING_TEXT,
      fullText: string = "",
      resolution: MenuResolution | null = null,
    ) => {
      // Handle semicolon trigger for recently created nodes
      switch (trigger) {
        case MenuEventTrigger.SHOW_RECENTLY_CREATED:
          setOptions(handleRecentNodes());
          // Toggle search and replace options visibility
          if (searchAndReplaceSetting !== searchAndReplaceDropdown) {
            setSearchAndReplaceSetting(searchAndReplaceDropdown);
            return null;
          }
          setSearchAndReplaceSetting(SearchAndReplaceDropdownOption.Always);
          return checkForSearchAndReplaceMatch(";", isLabellingRelation, SearchAndReplaceDropdownOption.Always);
        case MenuEventTrigger.HIDE_MENU_ON_ESCAPE:
          // RULE: Trigger -> Escape -> Text should not show dropdown
          // RULE: Trigger -> Escape -> Trigger -> text should show dropdown
          // Always Mode should never disable search & replace after Escape and require semi colon trigger to re-enable
          // Restore search and replace options visibility for handle semi colon trigger
          if (searchAndReplaceSetting !== searchAndReplaceDropdown)
            setSearchAndReplaceSetting(searchAndReplaceDropdown);
          return null;
        case MenuEventTrigger.SHOW_MENTIONS:
          return null;
        case MenuEventTrigger.SHOW_MATCHING_TEXT:
          prevText.current = fullText;
          const mentionMatch = checkForMentionMatch(fullText);
          const searchAndReplaceMatch = checkForSearchAndReplaceMatch(
            fullText,
            isLabellingRelation,
            searchAndReplaceSetting,
          );

          if (mentionMatch) {
            setCurrentAction(DropdownAction.MENTION);
          } else if (searchAndReplaceMatch) {
            setCurrentAction(DropdownAction.SEARCH_AND_REPLACE);
          } else {
            setCurrentAction(DropdownAction.NONE);
          }
          const match = mentionMatch ?? searchAndReplaceMatch;
          if (match && match.matchingString.length > 0) {
            const matchingText = match.matchingString.toLowerCase();
            updateOptions(fullText, matchingText, currentAction);
          } else {
            setOptions([]);
          }
          return match;
        case MenuEventTrigger.HIDE_MENU_ON_BLUR:
          setMenuState({ isOpen: false, resolution: null });
          return null;
        case MenuEventTrigger.SHOW_WITH_RESOLUTION:
          setMenuState({ isOpen: true, resolution });
        default:
          break;
      }
      return null;
    },
    [
      isLabellingRelation,
      searchAndReplaceSetting,
      handleRecentNodes,
      updateOptions,
      searchAndReplaceDropdown,
      currentAction,
      setMenuState,
    ],
  );
  const menuRenderFn = getMenuRenderFn(allOptions, queryString);

  const handleSelectOption = useCallback(
    (opt: DropdownOption, nodeToReplace: TextNode | null, closeMenu: () => void, matchingString: string) => {
      switch (currentAction) {
        case DropdownAction.MENTION:
          onMention(opt, nodeToReplace, closeMenu, matchingString);
          break;
        case DropdownAction.SEARCH_AND_REPLACE:
          onSearchAndReplace(opt, nodeToReplace, closeMenu, matchingString);
          break;
        case DropdownAction.NONE:
          // Default to search and replace with recent nodes when no action or text input
          // Used when semicolon is pressed without any text input to choose most recently created node
          onSearchAndReplace(opt, nodeToReplace, closeMenu, matchingString);
          break;
      }
    },
    [currentAction, onMention, onSearchAndReplace],
  );

  return (
    <LexicalTypeaheadMenuPlugin<DropdownOption>
      onSelectOption={handleSelectOption}
      menuState={menuState}
      menuStateHandler={menuStateHandler}
      options={allOptions}
      menuRenderFn={menuRenderFn}
      // High priority so it takes precedence over the split on enterkeyPlugin
      // and same level as toggleEditable Plugin command (which lets the enter key event propogate to this plugin on opening the dropdown)
      commandPriority={COMMAND_PRIORITY_HIGH}
      boundaryRef={boundaryRef}
    />
  );
}
