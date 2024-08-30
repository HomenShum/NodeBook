import { MenuOption, MenuRenderFn } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { ReactPortal, Ref, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { Path } from '@/app/components/Path';
import { GraphNode } from '@/app/graph/GraphNode';
import { GraphRelation, GraphRelationType, isGraphRelationType } from '@/app/graph/GraphRelation';
import { GraphStore } from '@/app/graph/GraphStore';
import { scoreMatch } from '@/lib/utils';

import styles from './DropdownMenuUtils.module.css';


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
      this.key = ActionId.CREATE_NEW_NODE;
    } else if (value instanceof GraphNode) {
      this.value = { type: DropdownOptionType.NODE, object: value };
      this.key = value.id;
    } else if (value instanceof GraphRelation) {
      this.value = { type: DropdownOptionType.RELATION, object: value };
      this.key = value.id;
    } else if (isGraphRelationType(value)) {
      this.value = { type: DropdownOptionType.RELATION_TYPE, object: value, isForward: isForward ?? true };
      this.key = value.id + (isForward ? "-fwd" : "-revrevrev");
    } else {
      this.value = { type: DropdownOptionType.ACTION, id: ActionId.CREATE_NEW_NODE };
      this.key = ActionId.CREATE_NEW_NODE;
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

export { ActionId, DropdownMenuItem, DropdownOptionType, filterAndSortOptions, getMentionSearchResults, getMenuRenderFn, getSearchAndReplaceResults };
