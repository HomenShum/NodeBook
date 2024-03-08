import { useEffect, useCallback, useMemo, useRef, useState, ReactPortal, Ref, } from "react";
import * as ReactDOM from "react-dom";
import { COMMAND_PRIORITY_NORMAL, TextNode } from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalTypeaheadMenuPlugin, MenuOption, MenuTextMatch, MenuRenderFn } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { GraphNode } from "../model/GraphNode";
import { useGraphStore } from "../store/graph";
import { useOutlineViewStore } from "../store/outline";
import styles from "./MentionPlugin.module.css";

// Much of this implementation is copied from:
// 
// https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/MentionsPlugin/index.tsx#L23

class MentionTypeaheadOption extends MenuOption {
  name: string;
  graphNode: GraphNode;
  constructor(name: string, graphNode: GraphNode, ) {
    super(name)
    this.name = name;
    this.graphNode = graphNode;
  }
}

export function MentionPlugin(): JSX.Element | null {
  const [queryString, setQueryString] = useState<string | null>(null);

  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const outlineViewStore = useOutlineViewStore();
  const onSelectOption = useCallback(
    (
      selectedOption: MentionTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void
    ) => {
      editor.update(() => {
        const mentionNode = new TextNode(selectedOption.name);
        mentionNode.setStyle("color: red;");
        if (nodeToReplace) {
          nodeToReplace.replace(mentionNode);
        }
        graphStore.createRelation({
          from: selectedOption.graphNode,
          to: outlineViewStore.focusedNode!.graphNode,
          type: graphStore.relationTypes.child,
        });
        mentionNode.select();
        closeMenu();
      });
    },
    [editor, graphStore, outlineViewStore]
  );

  const options : Array<MentionTypeaheadOption> = useMemo(() => {
    const SUGGESTION_LIST_LENGTH_LIMIT = 5;
    if (queryString === null) return [];
    return graphStore.nodes.filter(
      (node) => node.text.toLowerCase().includes(queryString.toLowerCase()) &&
        node.id !== outlineViewStore.focusedNode?.graphNode.id
    )
    .map((node) => new MentionTypeaheadOption(node.text, node))
    .slice(0, SUGGESTION_LIST_LENGTH_LIMIT);
  }, [queryString, graphStore.nodes, outlineViewStore.focusedNode]);

  const menuRenderFn = getMenuRenderFn(options);
  return (
    <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForMentionMatch}
      options={options}
      menuRenderFn={menuRenderFn}
      commandPriority={COMMAND_PRIORITY_NORMAL}
    />
  );
}

function checkForMentionMatch(text: string): MenuTextMatch | null {
  const PUNC = '\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%\'"~=<>_:;';
  const TRIGGERS = '@';

  // Chars we expect to see in a mention (non-space, non-punctuation).
  const VALID_CHARS = '[^' + TRIGGERS + PUNC + '\\s]';

  // Non-standard series of chars. Each series must be preceded and followed by
  // a valid char.
  const VALID_JOINS =
    '(?:' +
    '\\.[ |$]|' + // E.g. "r. " in "Mr. Smith"
    ' |' + // E.g. " " in "Josh Duck"
    '[' +
    PUNC +
    ']|' + // E.g. "-' in "Salier-Hellendag"
    ')';
  const LENGTH_LIMIT = 75;
  const AtSignMentionsRegex = new RegExp(
    '(^|\\s|\\()(' +
    '[' +
    TRIGGERS +
    ']' +
    '((?:' +
    VALID_CHARS +
    VALID_JOINS +
    '){0,' +
    LENGTH_LIMIT +
    '})' +
    ')$',
  );

  // 50 is the longest alias length limit.
  const ALIAS_LENGTH_LIMIT = 50;

  // Regex used to match alias.
  const AtSignMentionsRegexAliasRegex = new RegExp(
    '(^|\\s|\\()(' +
    '[' +
    TRIGGERS +
    ']' +
    '((?:' +
    VALID_CHARS +
    '){0,' +
    ALIAS_LENGTH_LIMIT +
    '})' +
    ')$',
  );

  const minMatchLength = 1;
  let match = AtSignMentionsRegex.exec(text);
  if (match === null) {
    match = AtSignMentionsRegexAliasRegex.exec(text);
  }
  if (match !== null) {
    // The strategy ignores leading whitespace but we need to know it's
    // length to add it to the leadOffset
    const maybeLeadingWhitespace = match[1];
    const matchingString = match[3];
    if (matchingString.length >= minMatchLength) {
      return {
        leadOffset: match.index + maybeLeadingWhitespace.length,
        matchingString,
        replaceableString: match[2],
      };
    }
  }
  return null;
}

function getMenuRenderFn(options: MentionTypeaheadOption[]): MenuRenderFn<MentionTypeaheadOption> {
  return (
    anchorElementRef,
    { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
  ): ReactPortal | JSX.Element | null => {
    // enable closing the autocomplete menu when clicking elsewhere
    const ref : Ref<HTMLDivElement> = useRef(null);
    const [show, setShow] = useState(true);
    useEffect(() => {
      const id = +new Date();
      const handleClickOutside = (event : MouseEvent) => {
        const target = event.target as Node;
        if (ref.current && !ref.current.contains(target)) {
          setShow(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      }
    });

    return anchorElementRef.current && options.length && show ? ReactDOM.createPortal(
      <div ref={ref} className={styles.TypeaheadPopover}>
        <ul>
          {options.map((option, i: number) => (
            <MentionsTypeaheadMenuItem
              index={i}
              isSelected={selectedIndex === i}
              onClick={() => {
                setHighlightedIndex(i);
                selectOptionAndCleanUp(option);
              } }
              onMouseEnter={() => {
                setHighlightedIndex(i);
              } }
              key={option.key}
              option={option} />
          ))}
        </ul>
      </div>,
      anchorElementRef.current
    ) : null
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
  let className = '';
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
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}>
      <span className="text">{option.name}</span>
    </li>
  );
}
