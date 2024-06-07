import { sortByPrefixMatch, useCurView } from "@/app/util";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  MenuRenderFn,
  MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { COMMAND_PRIORITY_HIGH, TextNode } from "lexical";
import { ReactPortal, Ref, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import { useRelationAtPath } from "../../components/RelatedObject/RelatedObjectContext";
import { useViewController } from "../../controller/useViewController";
import { GraphNode } from "../../model/GraphNode";
import { GraphObject } from "../../model/GraphObject";
import { $createMentionNode } from "../../model/MentionNode";
import { useGraphStore } from "../../model/useGraphStore";
import styles from "./MentionPlugin.module.css";

// Much of this implementation is copied from:
//
// https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/MentionsPlugin/index.tsx#L23

class MentionTypeaheadOption extends MenuOption {
  name: string;
  graphNode?: GraphNode;
  constructor(name: string, graphNode?: GraphNode) {
    super(name);
    this.name = name;
    this.graphNode = graphNode;
  }
}

export function MentionPlugin({ setDropdownOpen }: { setDropdownOpen: (isOpen: boolean) => void }): JSX.Element | null {
  const { object: node } = useRelationAtPath();
  const [queryString, setQueryString] = useState<string | null>(null);

  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const viewController = useViewController();
  const curView = useCurView();
  const onSelectOption = useCallback(
    (selectedOption: MentionTypeaheadOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      let graphNode: GraphNode; // For some reason have to declare this way to make TSC happy
      if (selectedOption.graphNode) {
        graphNode = selectedOption.graphNode;
      } else {
        // Create a new node
        const newNodeAndRelation = graphStore.createChildNode(graphStore.outlineRoot, {
          content: selectedOption.name.slice("Create new node: ".length),
        });
        graphNode = newNodeAndRelation.node;
      }
      editor.update(() => {
        const mentionNode = $createMentionNode(graphNode.id, graphNode.text);
        if (nodeToReplace) {
          nodeToReplace.replace(mentionNode);
        }
        if (
          !node.relations.some(
            (relation) =>
              relation.relationType == graphStore.relationTypesById.child &&
              relation.from == selectedOption.graphNode &&
              relation.to == node,
          )
        ) {
          graphStore.createRelation({
            from: graphNode,
            to: node,
            relationType: graphStore.relationTypesById.child,
          });
        }
        mentionNode.select();
        closeMenu();
      });
    },
    [editor, graphStore, node],
  );

  const options: Array<MentionTypeaheadOption> = useMemo(() => {
    const SUGGESTION_LIST_LENGTH_LIMIT = 5;
    if (queryString === null) return [];
    let matchingNodes = graphStore.nodes.filter(
      (n) => n.text.toLowerCase().includes(queryString.toLowerCase()) && n.id !== node.id,
    );
    sortByPrefixMatch(matchingNodes, queryString);

    const optionsForExistingNodes = matchingNodes
      .map((node) => new MentionTypeaheadOption(node.text, node))
      .slice(0, SUGGESTION_LIST_LENGTH_LIMIT);

    const newNodeOption = new MentionTypeaheadOption("Create new node: " + queryString);
    return [...optionsForExistingNodes, newNodeOption];
  }, [queryString, graphStore.nodes, node]);

  const menuRenderFn = getMenuRenderFn(options);
  return (
    <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={(text) => {
        const match = checkForMentionMatch(text);
        const shouldOpen = match !== null;
        setDropdownOpen(shouldOpen);
        return match;
      }}
      options={options}
      menuRenderFn={menuRenderFn}
      // High priority so it takes precedence over the split on enter command
      commandPriority={COMMAND_PRIORITY_HIGH}
    />
  );
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

  const minMatchLength = 3;
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
  const path = option.graphNode ? getTopMostParentPath(option.graphNode).slice(1) : [];
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
      <div className="flex flex-col">
        <div>{option.name}</div>
        {path.length > 0 && (
          <div className="flex items-center text-sm text-[--gray-9] h-[20px]">
            {path.map(({ key, text }) => (
              <span key={key}>
                {text}
                <span className="px-1">/</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Traverses up parent nodes, always going up the first parent we hit, and
 * returns the path of nodes.
 *
 * If we find a cycle, hit the root, or hit a limit, we return the current path.
 */
function getTopMostParentPath(
  node: GraphObject,
  { limit = 10 }: { limit?: number } = {},
): { key: string; text: string }[] {
  const path: GraphObject[] = [];
  let current: GraphObject | undefined = node;

  for (let i = 0; i < limit && current; i++) {
    const parent: GraphObject | undefined = current.relationsSortedByPosition.find(
      (r) => r.relationType.id === "child" && r.to === current,
    )?.from;
    if (!parent || path.some((p) => p.id === parent.id)) {
      return path.map((p) => ({ key: p.id, text: p.text }));
    }
    path.unshift(parent);
    current = parent;
  }
  return [{ key: "ellipses", text: "..." }, ...path.map((p) => ({ key: p.id, text: p.text }))];
}
