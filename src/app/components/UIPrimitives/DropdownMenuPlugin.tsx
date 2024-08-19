import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalTypeaheadMenuPlugin, MenuOption, MenuRenderFn } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {
  COMMAND_PRIORITY_HIGH, TextNode
} from "lexical";
import { ReactPortal, Ref, useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { Path } from '@/app/components/Path';
import { GraphNode } from '@/app/graph/GraphNode';
import { GraphRelation, GraphRelationType, isGraphRelationType } from '@/app/graph/GraphRelation';
import { defaultRelationTypes, GraphStore } from '@/app/graph/GraphStore';
import { $createMentionNode } from '@/app/graph/MentionNode';
import { useGraphStore } from '@/app/graph/useGraphStore';
import { useSettingsStore } from '@/app/graph/useSettingsStore';
import { DescendantTreeNode, RootTreeNode } from '@/app/tree/nodes';
import { useTree } from '@/app/tree/TreeContext';
import { uuid } from "@/app/util";
import logger from '@/lib/logger';
import { checkForMentionMatch, checkForSearchAndReplaceMatch, scoreMatch } from '@/lib/utils';

import styles from './DropdownMenuPlugin.module.css';



const SUGGESTION_LIST_LENGTH_LIMIT = 5;


enum DropdownOptionType {
  NODE = "node",
  RELATION = "relation",
  RELATION_TYPE = "relationType",
  ACTION = "action",
}

enum ActionId {
  CREATE_NEW_NODE = "create-new-node",
}

type DropdownOptionValueNode = {
  type: DropdownOptionType.NODE;
  object: GraphNode;
};

type DropdownOptionValueRelation = {
  type: DropdownOptionType.RELATION;
  object: GraphRelation;
};

type DropdownOptionValueRelationType = {
  type: DropdownOptionType.RELATION_TYPE;
  object: GraphRelationType;
  isForward: boolean;
};

type DropdownOptionValueAction = {
  type: DropdownOptionType.ACTION;
  id: ActionId;
};

type DropdownOptionValue =
  | DropdownOptionValueNode
  | DropdownOptionValueRelation
  | DropdownOptionValueRelationType
  | DropdownOptionValueAction;

export class DropdownOption extends MenuOption {
  value: DropdownOptionValue;

  constructor(value: GraphNode | GraphRelation | GraphRelationType | ActionId, isForward?: boolean) {
    super(typeof value === "string" ? value : value.id);
    if (value === ActionId.CREATE_NEW_NODE) {
      this.value = { type: DropdownOptionType.ACTION, id: ActionId.CREATE_NEW_NODE };
    } else if (value instanceof GraphNode) {
      this.value = { type: DropdownOptionType.NODE, object: value };
    } else if (value instanceof GraphRelation) {
      this.value = { type: DropdownOptionType.RELATION, object: value };
    }
    else if (isGraphRelationType(value)) {
      this.value = { type: DropdownOptionType.RELATION_TYPE, object: value, isForward: isForward ?? true };
    } else {
      this.value = { type: DropdownOptionType.ACTION, id: ActionId.CREATE_NEW_NODE };
    }
  }

  get name() {
    switch (this.value.type) {
      case DropdownOptionType.NODE:
        return this.value.object.text;
      case DropdownOptionType.RELATION:
        return this.value.object.text;
      case DropdownOptionType.RELATION_TYPE:
        return this.value.isForward ? this.value.object.label : this.value.object.reverseLabel;
      case DropdownOptionType.ACTION:
        return "Create new node";
      default:
        return "";
    }
  }

  get matchText() {
    switch (this.value.type) {
      case DropdownOptionType.NODE:
        return this.value.object.text;
      case DropdownOptionType.RELATION:
        return this.value.object.text;
      case DropdownOptionType.RELATION_TYPE:
        return this.value.isForward ? this.value.object.label : this.value.object.reverseLabel;
      case DropdownOptionType.ACTION:
        return ActionId.CREATE_NEW_NODE;
      default:
        return "";
    }
  }
}

function getMentionSearchResults(
  graphStore: GraphStore,
  queryString: string,
  currentNodeId: string
): DropdownOption[] {
  let { nodes } = graphStore.search({
    text: queryString,
    filters: {
      types: [DropdownOptionType.NODE]
    },
    sort: { by: "score" },
  });
  // ignore the current object
  nodes = nodes.filter(({ node }) => node.id !== currentNodeId);
  return nodes.map(({ node }) => new DropdownOption(node));
}

function getSearchAndReplaceResults(
  graphStore: GraphStore,
  queryString: string,
  isLabellingRelation: boolean,
  currentNodeId: string,
  currentRelationId: string | undefined,
  currentRelationTypeId: string | undefined
): DropdownOption[] {
  let { nodes, relations, relationTypes } = graphStore.search({
    text: queryString,
    filters: {
      types: isLabellingRelation
        ? [DropdownOptionType.NODE, DropdownOptionType.RELATION]
        : [DropdownOptionType.NODE, DropdownOptionType.RELATION, DropdownOptionType.RELATION_TYPE],
    },
    sort: { by: "score" },
  });

  // ignore the current object and relation
  nodes = nodes.filter(({ node }) => node.id !== currentNodeId);
  relations = relations.filter(
    ({ relation }) => relation.id !== currentNodeId && relation.id !== currentRelationId
  );
  relationTypes = relationTypes.filter(({ relationType }) => relationType.id !== currentRelationTypeId);

  // map to dropdown options
  return [
    ...relationTypes.flatMap(({ relationType }) => {
      const options: DropdownOption[] = [];
      if (relationType.label.toLowerCase().includes(queryString)) {
        options.push(new DropdownOption(relationType, true));
      }
      if (relationType.reverseLabel.toLowerCase().includes(queryString)) {
        options.push(new DropdownOption(relationType, false));
      }
      return options;
    }).slice(0, 5),
    ...nodes.map(({ node }) => new DropdownOption(node)).slice(0, 5),
    ...relations.map(({ relation }) => new DropdownOption(relation)).slice(0, 5),
  ];
}

function filterAndSortOptions(prevOptions: DropdownOption[], queryString: string): DropdownOption[] {
  return prevOptions
    .filter((option) => option.name.toLowerCase().includes(queryString))
    .sort(
      (a, b) =>
        scoreMatch(queryString, b.matchText.toLowerCase()) -
        scoreMatch(queryString, a.matchText.toLowerCase()),
    );
}

export function DropdownMenuPlugin({
  treeNode,
}: {
  treeNode: DescendantTreeNode | RootTreeNode;
}): JSX.Element | null {
  const node = treeNode.object;
  const [editor] = useLexicalComposerContext();
  const graphStore = useGraphStore();
  const object = treeNode.object;
  const tree = useTree();
  const relation = treeNode.relationWithParent;
  const isLabellingRelation = relation?.isLabelled() ?? false;
  const settingsStore = useSettingsStore();


  const prevText = useRef<string | null>(null);

  const [options, setOptions] = useState<DropdownOption[]>([]);
  const limitedOptions = options.slice(0, SUGGESTION_LIST_LENGTH_LIMIT);
  const [isOnSelectOptionMention, setIsOnSelectOptionMention] = useState(true);
  const allOptions = isOnSelectOptionMention
    ? [...limitedOptions.slice(0, -1), new DropdownOption(ActionId.CREATE_NEW_NODE)]
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
          (r) => r.relationType === defaultRelationTypes.child && r.from === node && r.to.id === graphNodeId,);
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
                (option.value as never) satisfies never;
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
            (option as never) satisfies never;
        }
      } catch (e) {
        logger.error("Error selecting dropdown option", e);
      } finally {
      }
    },
    [graphStore, relation, object, tree, treeNode],
  );
  const menuRenderFn = getMenuRenderFn(allOptions, prevText.current ?? '');

  return (
    <LexicalTypeaheadMenuPlugin<DropdownOption>
      onQueryChange={() => { }}
      onSelectOption={isOnSelectOptionMention ? onMention : onSearchAndReplace}
      triggerFn={(text) => {
        const mentionMatch = checkForMentionMatch(text)
        console.log('mentionMatch', mentionMatch);
        const searchAndReplaceMatch = checkForSearchAndReplaceMatch(text, isLabellingRelation, settingsStore.searchAndReplaceDropdown);

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
                relation?.relationType.id
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
      // High priority so it takes precedence over the split on enter command
      commandPriority={COMMAND_PRIORITY_HIGH}
    />
  );
}

function getMenuRenderFn(options: DropdownOption[], queryString: string): MenuRenderFn<DropdownOption> {
  return (
    anchorElementRef,
    { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
  ): ReactPortal | JSX.Element | null => {
    // enable closing the autocomplete menu when clicking elsewhere
    const ref: Ref<HTMLDivElement> = useRef(null);
    const [show, setShow] = useState(true);
    useEffect(() => {
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
              <DropdownMenuItem
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
                queryString={queryString}
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

function DropdownMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
  queryString,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: DropdownOption;
  queryString: string;
}) {
  const className = `${styles.TypeaheadPopoverItem} ${isSelected ? styles.Selected : ''}`;

  const renderOptionContent = () => {
    switch (option.value.type) {
      case DropdownOptionType.RELATION_TYPE:
        const label = option.value.isForward ? option.value.object.label : option.value.object.reverseLabel
        return <div>{label + ':'}</div>;
      case DropdownOptionType.ACTION:
        // Remove the '@' symbol and any preceding characters from the query string
        return <div>{"Create new node: " + queryString.slice(queryString.lastIndexOf('@') + 1)} </div>;
      case DropdownOptionType.NODE:
        return <div>{option.value.object.text}</div>;
      case DropdownOptionType.RELATION:
        return <div>{option.value.object.text}</div>;
      default:
        return <div>{option.name}</div>;
    }
  };

  const renderPath = () => {
    if (option.value.type === DropdownOptionType.NODE) {
      return <Path path={option.value.object.getPath()} />;
    }
    return null;
  };

  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={className}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={`typeahead-item-${index}`}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <div className={styles.TypeaheadPopoverItem}>
        {renderOptionContent()}
        {renderPath()}
      </div>
    </li>
  );
}