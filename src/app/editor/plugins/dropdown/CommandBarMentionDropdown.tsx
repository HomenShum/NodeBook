import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalTypeaheadMenuPlugin } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { COMMAND_PRIORITY_NORMAL, TextNode } from "lexical";
import { useCallback, useState } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { MentionTypeaheadOption, getMenuRenderFn } from "@/app/editor/plugins/dropdown/MentionDropdown";
import { MentionDropdown } from "@/app/editor/plugins/dropdown/types";
import { useGetMatches, useGetRecentNodes } from "@/app/editor/plugins/dropdown/utils";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { uuid } from "@/app/util";
import { checkForMentionMatch } from "@/lib/utils";

const MAX_COMMAND_BAR_DROPDOWN_RESULTS = 5;

interface Props {
  dropdownContainerRef: React.RefObject<HTMLElement>;
}

/** Mostly copied from {@link MentionDropdown} */
export function CommandBarMentionDropdown({ dropdownContainerRef }: Props) {
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const getMatches = useGetMatches(MAX_COMMAND_BAR_DROPDOWN_RESULTS);
  const getRecentNodes = useGetRecentNodes(MAX_COMMAND_BAR_DROPDOWN_RESULTS);
  const [dropdown, setDropdown] = useState<MentionDropdown | null>(null);

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
      // Open mention dropdown after @ match
      const match = checkForMentionMatch(textBeforeCursor);
      if (match) {
        const queryString = match.matchingString;
        if (queryString.length === 0) {
          setDropdown({
            type: "mention",
            search: queryString,
            matches: getRecentNodes(),
          });
        } else {
          setDropdown({
            type: "mention",
            search: queryString,
            matches: getMatches(queryString, ["node"]),
          });
        }
        return match;
      }

      return null;
    },
    [getMatches, getRecentNodes],
  );

  const onSelectOption = useCallback(
    async (opt: MentionTypeaheadOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      if (!nodeToReplace) return;
      // update editor
      const graphNodeId = opt.value.type === "new" ? uuid() : opt.value.object.id;
      const text = opt.value.type === "new" ? opt.value.text : opt.value.object.text;
      editor.update(async () => {
        const mentionNode = $createMentionNode(graphNodeId, text);
        nodeToReplace.replace(mentionNode);
        mentionNode.selectEnd();
        if (opt.value.type === "new") {
          await graphStore.addChildNode({
            parentId: graphStore.userRoot.id,
            nodeProps: { id: graphNodeId, content: opt.name.slice("Create new node: ".length) },
          });
        }
        closeMenu();
      });
    },
    [editor, graphStore],
  );

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
