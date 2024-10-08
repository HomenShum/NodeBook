import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalTypeaheadMenuPlugin, MenuOption, MenuRenderFn } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { COMMAND_PRIORITY_HIGH, TextNode } from "lexical";
import { ReactPortal, useCallback } from "react";
import * as ReactDOM from "react-dom";

import { Path } from "@/app/components/Path";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { Dropdown } from "@/app/editor/plugins/dropdown/types";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { TreeNode } from "@/app/tree/nodes";
import { uuid } from "@/app/util";
import { MenuTextMatch, cn } from "@/lib/utils";

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
  const options =
    dropdown?.type === "mention"
      ? [
          ...dropdown.matches
            .filter((m) => m.type === "node")
            .map((m) => new MentionTypeaheadOption(m.object))
            .slice(0, 10),
          new MentionTypeaheadOption(dropdown.search),
        ]
      : [];

  const onSelectOption = useCallback(
    async (opt: MentionTypeaheadOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      if (!nodeToReplace) return;
      // update editor
      const graphNodeId = opt.value.type === "new" ? uuid() : opt.value.object.id;
      const text = opt.value.type === "new" ? opt.value.text : opt.value.object.text;
      editor.update(async () => {
        const mentionNode = $createMentionNode(graphNodeId, text);
        nodeToReplace.replace(mentionNode);
        if (opt.value.type === "new") {
          await graphStore.addChildNode({
            parentId: graphStore.userRoot.id,
            nodeProps: { id: graphNodeId, content: opt.name.slice("Create new node: ".length) },
          });
        }
        closeMenu();
        // add relation
        const hasMentionRelation = treeNode.object.relations.some(
          (r) =>
            r.relationType == defaultRelationTypes.relatedTo && r.from == treeNode.object && r.to.id === graphNodeId,
        );
        if (!hasMentionRelation) {
          await graphStore.addRelation({
            fromId: graphNodeId,
            toId: treeNode.object.id,
          });
        }
      });
    },
    [editor, treeNode, graphStore],
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

class MentionTypeaheadOption extends MenuOption {
  value: { type: "existing"; object: GraphNode } | { type: "new"; text: string };
  constructor(value: GraphNode | string) {
    super(typeof value === "string" ? value : value.id);
    this.value = typeof value === "string" ? { type: "new", text: value } : { type: "existing", object: value };
  }
  get name() {
    return this.value.type === "new" ? `Create new node: ${this.value.text}` : this.value.object.text;
  }
  get matchText() {
    return this.value.type === "new" ? this.value.text : this.value.object.text;
  }
}

export function checkForMentionMatch(text: string): MenuTextMatch | null {
  const PUNC = "\\.,\\+\\*\\?\\$\\@\\|{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;";
  const TRIGGERS = "@";

  // Chars we expect to see in a mention (non-space, non-punctuation).
  const VALID_CHARS = "[^" + TRIGGERS + PUNC + "\\s]";

  // Non-standard series of chars. Each series must be preceded and followed by
  // a valid char.
  const VALID_JOINS =
    "(?:" +
    "\\.[ |$]|" + // E.g. "r. " in "Mr. Smith"
    " |" + // E.g. " " in "Josh Duck"
    "[" +
    PUNC +
    "]|" + // E.g. "-' in "Salier-Hellendag"
    ")";
  const LENGTH_LIMIT = 75;
  const AtSignMentionsRegex = new RegExp(
    "(^|\\s|\\()(" + "[" + TRIGGERS + "]" + "((?:" + VALID_CHARS + VALID_JOINS + "){0," + LENGTH_LIMIT + "})" + ")$",
  );

  // 50 is the longest alias length limit.
  const ALIAS_LENGTH_LIMIT = 50;

  // Regex used to match alias.
  const AtSignMentionsRegexAliasRegex = new RegExp(
    "(^|\\s|\\()(" + "[" + TRIGGERS + "]" + "((?:" + VALID_CHARS + "){0," + ALIAS_LENGTH_LIMIT + "})" + ")$",
  );

  let match = AtSignMentionsRegex.exec(text);
  if (match === null) {
    match = AtSignMentionsRegexAliasRegex.exec(text);
  }
  if (match !== null) {
    // The strategy ignores leading whitespace but we need to know it's
    // length to add it to the leadOffset
    const maybeLeadingWhitespace = match[1];
    const matchingString = match[3];
    return {
      leadOffset: match.index + maybeLeadingWhitespace.length,
      matchingString,
      replaceableString: match[2],
    };
  }
  return null;
}

function getMenuRenderFn(options: MentionTypeaheadOption[]): MenuRenderFn<MentionTypeaheadOption> {
  return (
    anchorElementRef,
    { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
  ): ReactPortal | JSX.Element | null => {
    return anchorElementRef.current && options.length
      ? ReactDOM.createPortal(
          <div className={cn(styles.Dropdown, styles.TypeaheadPopover)}>
            <ul>
              {options.map((option, i: number) => (
                <li
                  key={option.key}
                  tabIndex={-1}
                  className={selectedIndex === i ? styles.Selected : ""}
                  ref={option.setRefElement}
                  role="option"
                  aria-selected={selectedIndex === i}
                  id={"typeahead-item-" + i}
                  onMouseEnter={() => {
                    setHighlightedIndex(i);
                  }}
                  onClick={() => {
                    setHighlightedIndex(i);
                    selectOptionAndCleanUp(option);
                  }}
                >
                  <div className={styles.DropdownItem}>
                    <div>{option.name}</div>
                    {option.value.type === "existing" && <Path path={option.value.object.getPath()} />}
                  </div>
                </li>
              ))}
            </ul>
          </div>,
          anchorElementRef.current,
        )
      : null;
  };
}
