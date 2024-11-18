import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
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
import { useTree } from "@/app/tree/TreeContext";
import { uuid } from "@/app/util";
import { MenuTextMatch, cn } from "@/lib/utils";

import { LexicalTypeaheadMenuPlugin, MenuOption, MenuRenderFn } from "./LexicalTypeaheadPlugin";

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
  const tree = treeNode.tree;

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
        mentionNode.selectEnd();

        if (opt.value.type === "new") {
          await graphStore.addChildNode({
            parentId: graphStore.userRoot.id,
            nodeProps: { id: graphNodeId, content: opt.name.slice("Create new node: ".length) },
          });
        }
        closeMenu();
        // add relation
        const hasMentionOrParentRelation = treeNode.object.relations.some(
          (r) =>
            (r.relationType == defaultRelationTypes.relatedTo &&
              r.from == treeNode.object &&
              r.to.id === graphNodeId) ||
            (r.relationType.id === defaultRelationTypes.child.id &&
              r.to.id === treeNode.object.id &&
              r.from.id === graphNodeId),
        );

        if (!hasMentionOrParentRelation) {
          await graphStore.addRelation({
            fromId: graphNodeId,
            toId: treeNode.object.id,
          });
        } else {
          //NOOP - The mention node isn't rendered without this.
          await graphStore.applyUpdates([]);
        }

        tree.setFocusedNode(treeNode.path, "end", true);
      });
    },
    [editor, tree, treeNode, graphStore],
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

export class MentionTypeaheadOption extends MenuOption {
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

export function getMenuRenderFn(
  options: MentionTypeaheadOption[],
  forCommandBar = false,
): MenuRenderFn<MentionTypeaheadOption> {
  return function MenuRenderFn(
    anchorElementRef,
    { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
  ): ReactPortal | JSX.Element | null {
    const Menu = (
      <div className={cn(styles.Dropdown, styles.TypeaheadPopover, forCommandBar && styles.ForCommandBar)}>
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
              onClick={(e) => {
                e.stopPropagation();
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
      </div>
    );

    if (!anchorElementRef.current || !options.length) {
      return null;
    }

    return ReactDOM.createPortal(Menu, anchorElementRef.current);
  };
}
