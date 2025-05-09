import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalTypeaheadMenuPlugin } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { COMMAND_PRIORITY_NORMAL, TextNode } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { getMenuRenderFn, MentionTypeaheadOption } from "@/app/editor/plugins/dropdown/MentionDropdown";
import { MentionDropdown } from "@/app/editor/plugins/dropdown/types";
import {
  useGetMatchesForCommandBar,
  useGetMatchesForHashtags,
  useGetRecentHashtags,
  useGetRecentNodes,
} from "@/app/editor/plugins/dropdown/utils";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { uuid } from "@/app/util";
import { checkForMentionMatch, DOUBLE_BRACKET, HASHTAG_SYMBOL, MENTION_SYMBOL } from "@/lib/utils";

const MAX_COMMAND_BAR_DROPDOWN_RESULTS = 5;

interface Props {
  dropdownContainerRef: React.RefObject<HTMLElement>;
}

/** Mostly copied from {@link MentionDropdown} */
export function CommandBarMentionDropdown({ dropdownContainerRef }: Props) {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();
  const getMatches = useGetMatchesForCommandBar(MAX_COMMAND_BAR_DROPDOWN_RESULTS);
  const getRecentNodes = useGetRecentNodes(MAX_COMMAND_BAR_DROPDOWN_RESULTS);
  const getRecentHashtags = useGetRecentHashtags(MAX_COMMAND_BAR_DROPDOWN_RESULTS);
  const getMatchesForHashtags = useGetMatchesForHashtags(MAX_COMMAND_BAR_DROPDOWN_RESULTS);
  const [dropdown, setDropdown] = useState<MentionDropdown | null>(null);
  const textChanged = useRef(false);

  const options = dropdown
    ? [
        ...dropdown?.matches
          .filter((m) => m.type === "node")
          .map((m) => new MentionTypeaheadOption(m.object))
          .slice(0, 10),
        new MentionTypeaheadOption(dropdown.search),
      ]
    : [];

  const triggerFn = useCallback(
    (textBeforeCursor: string) => {
      // Don't open any dropdowns until the text has changed after focus
      if (!textChanged.current) {
        return null;
      }

      // Open mention dropdown after @ match
      const match = checkForMentionMatch(textBeforeCursor, settingsStore.useRoamResearchStyleMention);
      if (match) {
        const queryString = match.matchingString;
        if (queryString.length === 0) {
          setDropdown({
            type: "mention",
            search: queryString,
            matches: match.mentionTrigger === HASHTAG_SYMBOL ? getRecentHashtags() : getRecentNodes(),
            mentionTrigger: match.mentionTrigger,
          });
        } else {
          setDropdown({
            type: "mention",
            search: queryString,
            matches:
              match.mentionTrigger === HASHTAG_SYMBOL
                ? getMatchesForHashtags(queryString)
                : getMatches(queryString, ["node"]),
            mentionTrigger: match.mentionTrigger,
          });
        }
        return match;
      }

      return null;
    },
    [settingsStore.useRoamResearchStyleMention, getRecentHashtags, getRecentNodes, getMatchesForHashtags, getMatches],
  );

  const onSelectOption = useCallback(
    async (opt: MentionTypeaheadOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      if (!nodeToReplace) return;
      // update editor
      const graphNodeId = opt.value.type === "new" ? uuid() : opt.value.object.id;
      const text = opt.value.type === "new" ? opt.value.text : opt.value.object.text;
      editor.update(async () => {
        if (!dropdown) return;
        const mentionNode = $createMentionNode(
          graphNodeId,
          dropdown.mentionTrigger === HASHTAG_SYMBOL && opt.value.type === "new" ? "#" + text : text,
          dropdown.mentionTrigger ?? MENTION_SYMBOL,
        );
        nodeToReplace.replace(mentionNode);

        if (dropdown.mentionTrigger === DOUBLE_BRACKET) {
          const beforeMention = new TextNode("[[");
          mentionNode.insertBefore(beforeMention);
          const spaceAfter = new TextNode("]] ");
          mentionNode.insertAfter(spaceAfter);
          spaceAfter.selectEnd();
        } else {
          const spaceAfter = new TextNode(" ");
          mentionNode.insertAfter(spaceAfter);
          spaceAfter.selectEnd();
        }

        if (opt.value.type === "new") {
          const newNodeText = opt.name.slice("Create new node: ".length);
          const newNodeIsHashtag = dropdown.mentionTrigger === HASHTAG_SYMBOL;
          const parentId = newNodeIsHashtag ? graphStore.myHashtagsNodeId : graphStore.userRootId;
          await graphStore.addChildNode({
            parentId: parentId,
            nodeProps: { id: graphNodeId, content: newNodeIsHashtag ? "#" + newNodeText : newNodeText },
          });
          await graphStore.applyUpdates([]);
        }

        closeMenu();
      });
    },
    [editor, graphStore, dropdown],
  );

  // Handle state transitions which {@link triggerFn} can't handle
  useEffect(() => {
    return editor.registerTextContentListener((text) => {
      textChanged.current = true;
      if (text === "") {
        setDropdown(null);
      }
    });
  }, [editor]);

  return (
    <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
      onQueryChange={() => {}}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={getMenuRenderFn(options, true)}
      commandPriority={COMMAND_PRIORITY_NORMAL}
      parent={dropdownContainerRef.current ?? undefined}
    />
  );
}
