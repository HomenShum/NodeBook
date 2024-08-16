import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  MenuRenderFn,
  MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { COMMAND_PRIORITY_HIGH, TextNode } from "lexical";
import { ReactPortal, Ref, useCallback, useEffect, useRef, useState } from "react";
import * as ReactDOM from "react-dom";

import { Path } from "@/app/components/Path";
import { GraphNode } from "@/app/graph/GraphNode";
import { defaultRelationTypes } from "@/app/graph/GraphStore";
import { $createMentionNode } from "@/app/graph/MentionNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { TreeNode } from "@/app/tree/nodes";
import { uuid } from "@/app/util";
import { scoreMatch } from "@/lib/utils";

import styles from "./MentionPlugin.module.css";

const SUGGESTION_LIST_LENGTH_LIMIT = 5;

// Much of this implementation is copied from:
//
// https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/MentionsPlugin/index.tsx#L23

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

export function MentionPlugin({
  treeNode,
  setDropdownOpen = () => {},
}: {
  treeNode: TreeNode;
  setDropdownOpen?: (isOpen: boolean) => void;
}): JSX.Element | null {
  const node = treeNode.object;
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();

  const onSelectOption = useCallback(
    async (opt: MentionTypeaheadOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      if (!nodeToReplace) return;

      const graphNodeId = opt.value.type === "new" ? uuid() : opt.value.object.id;
      const text = opt.value.type === "new" ? opt.value.text : opt.value.object.text;
      editor.update(async () => {
        const mentionNode = $createMentionNode(graphNodeId, text);
        nodeToReplace.replace(mentionNode);
        mentionNode.selectEnd();

        if (opt.value.type === "new") {
          await graphStore.addChildNode({
            parentId: graphStore.outlineRoot.id,
            nodeProps: { id: graphNodeId, content: opt.name.slice("Create new node: ".length) },
          });
        }

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

  const prevText = useRef<string | null>(null);

  const [options, setOptions] = useState<MentionTypeaheadOption[]>([]);
  const limitedOptions = options.slice(0, SUGGESTION_LIST_LENGTH_LIMIT);
  const menuRenderFn = getMenuRenderFn(limitedOptions);

  return (
    <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
      onQueryChange={() => {}}
      onSelectOption={onSelectOption}
      triggerFn={(text) => {
        const match = checkForMentionMatch(text);
        if (match && match.matchingString.length > 0) {
          setDropdownOpen(true);
          const queryString = match.matchingString.toLocaleLowerCase();
          setOptions((prevOptions) => {
            if (prevOptions.length > 0 && prevText.current && text.startsWith(prevText.current)) {
              // If we've just added to the query, we can filter the existing options
              return [
                ...prevOptions
                  .slice(0, -1)
                  .filter((option) => option.name.toLowerCase().includes(queryString))
                  .sort(
                    (a, b) =>
                      scoreMatch(queryString, b.matchText.toLocaleLowerCase()) -
                      scoreMatch(queryString, a.matchText.toLocaleLowerCase()),
                  ),
                new MentionTypeaheadOption(queryString),
              ];
            } else {
              // Otherwise, we need to search the graph
              const matchingNodes = graphStore
                .search({ text: queryString, filters: { types: ["node"] }, sort: { by: "score" } })
                .nodes.filter((a) => a.node.id !== treeNode.object.id)
                .map(({ node }) => node);
              return [
                ...matchingNodes.map((node) => new MentionTypeaheadOption(node)),
                new MentionTypeaheadOption(queryString),
              ];
            }
          });
        } else {
          setDropdownOpen(false);
          setOptions([]);
        }
        prevText.current = text;
        return match;
      }}
      options={limitedOptions}
      menuRenderFn={menuRenderFn}
      // High priority so it takes precedence over the split on enter command
      commandPriority={COMMAND_PRIORITY_HIGH}
    />
  );
}

function checkForMentionMatch(text: string): MenuTextMatch | null {
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
    // enable closing the autocomplete menu when clicking elsewhere
    const ref: Ref<HTMLDivElement> = useRef(null);
    const [show, setShow] = useState(true);
    useEffect(() => {
      const id = +new Date();
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (ref.current && !ref.current.contains(target)) {
          setShow(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    });

    return anchorElementRef.current && options.length && show
      ? ReactDOM.createPortal(
          <div ref={ref} className={styles.TypeaheadPopover}>
            <ul>
              {options.map((option, i: number) => (
                <MentionsTypeaheadMenuItem
                  index={i}
                  isSelected={selectedIndex === i}
                  onClick={() => {
                    setHighlightedIndex(i);
                    selectOptionAndCleanUp(option);
                  }}
                  onMouseEnter={() => {
                    setHighlightedIndex(i);
                  }}
                  key={option.key}
                  option={option}
                />
              ))}
            </ul>
          </div>,
          anchorElementRef.current,
        )
      : null;
  };
}

function MentionsTypeaheadMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: MentionTypeaheadOption;
}) {
  let className = "";
  if (isSelected) {
    className = styles.Selected;
  }
  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={className}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={"typeahead-item-" + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <div className={styles.TypeaheadPopoverItem}>
        <div>{option.name}</div>
        {option.value.type === "existing" && <Path path={option.value.object.getPath()} />}
      </div>
    </li>
  );
}
