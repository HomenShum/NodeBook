import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";

type Props = {
  treeNode: DescendantTreeNode;
  isEditorEditable: boolean;
};

/**
 * Renders an invisible input at the start of a tree node, allowing user
 * interaction with non-editable content. This allows the user to still focus
 * the node and enabling actions like splitting nodes.
 *
 * When isEditorEditable is false, it becomes responsible for grabbing the
 * selection in response to tree selection changes.
 */
export const TreeNodeInputPrefix = observer(function TreeNodeInputSuffix({ treeNode, isEditorEditable }: Props) {
  const tree = treeNode.tree;
  const graphStore = useGraphStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Only grab selection if  tree node
  const treeNodeShouldHaveFocus = tree.selection?.type === "editor" && tree.selection.treeNodeId === treeNode.id;
  const isStartPosition = tree.selection?.type === "editor" && tree.selection.position === "start";
  useEffect(() => {
    if (!isEditorEditable) {
      const inputFocused = inputRef.current?.contains(document.activeElement);
      if (!inputFocused && treeNodeShouldHaveFocus && isStartPosition) {
        inputRef.current?.focus();
      } else if (inputFocused && !treeNodeShouldHaveFocus) {
        inputRef.current?.blur();
      }
    }
  }, [treeNodeShouldHaveFocus, isEditorEditable, isStartPosition]);

  return (
    <input
      style={{
        maxWidth: 8,
        backgroundColor: "transparent",
        padding: 0,
        border: 0,
        outline: "none",
        marginLeft: -7,
        top: 2,
        position: "absolute",
        zIndex: 1,
        cursor: "text",
        pointerEvents: "all",
        caretColor: "var(--gray-12)",
      }}
      onFocus={() => {
        if (!tree.isNodeFocused(treeNode.id)) {
          tree.setFocusedNode(treeNode.path);
        }
      }}
      //Todo: Can this be replaced with hotkeys?
      onKeyDown={async (e: React.KeyboardEvent) => {
        const isMod = e.metaKey || e.ctrlKey;
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            if (e.shiftKey) {
              await tree.splitIntoNote(treeNode);
            } else {
              await tree.split(treeNode, {
                before: [],
                after: (treeNode.object && treeNode.object instanceof GraphNode && treeNode.object.content) || [],
              });
            }
            break;
          case "Backspace":
            if (!treeNode.isAtCanonicalPath) {
              const object = treeNode.object;
              const relation = treeNode.relationWithParent;
              try {
                if (
                  treeNode.relationWithParent.relationType.id === defaultRelationTypes.child.id &&
                  treeNode.relationWithParent.to === object
                ) {
                  return false;
                }
                // Go ahead with removing relation type and setting content

                const isForward = relation.to.id === object.id;
                let labelText = isForward ? relation.relationType.label : relation.relationType.reverseLabel;
                labelText += treeNode.object.text.length > 0 ? " " : "";

                const oldContent = graphStore.getNode(object.id)?.content ?? [];

                graphStore.applyCombinedTransaction([
                  {
                    type: "updateRelation",
                    transaction: {
                      relationId: relation.id,
                      relationProps: { relationType: defaultRelationTypes.child },
                      reverse: !isForward,
                    },
                  },
                ]);
                tree.setFocusedNode(treeNode.id, { anchorOffset: labelText.length, focusOffset: labelText.length });
                return true;
              } catch (error) {
                alert(error instanceof Error ? error.message : "Unknown error");
              }
            }
            break;
          case "ArrowRight":
            e.preventDefault();
            tree.setFocusedNode(treeNode.id, "end");
            break;
          case "ArrowLeft":
            // If the node has a custom relation type, focus on the relation type prefix
            const relationType = treeNode.relationWithParent.relationType;
            if (!(relationType.id === "child" && treeNode.relationWithParent.to === treeNode.object)) {
              const prefixInput = document.querySelector(`[data-node-prefix="${treeNode.object.id}"]`);
              if (prefixInput instanceof HTMLElement) {
                prefixInput.focus();
                return true;
              }
            }
          case "ArrowUp":
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            if (isMod && e.shiftKey) {
              tree.moveSelectedNodesUp();
              break;
            }
            e.metaKey || e.ctrlKey ? tree.collapseAtSelection() : tree.moveEditorSelectionUp("end");
            break;
          case "ArrowDown":
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            if (isMod && e.shiftKey) {
              tree.moveSelectedNodesDown();
              break;
            }
            e.metaKey || e.ctrlKey ? tree.expandAtSelection() : tree.moveEditorSelectionDown("start");
            break;
          case "Tab":
            e.preventDefault();
            tree.indentSelection();
            break;
        }
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!tree.isNodeFocused(treeNode.id)) {
          tree.setFocusedNode(treeNode.path);
        }
        e.currentTarget.focus();
      }}
      ref={inputRef}
      type="text"
      value=""
      onChange={async (e) => {
        // When a user types in the input, apply the content to the end of the
        // node and then switch back into edit mode.
        // Requested in https://ideaflowteam.slack.com/archives/C07FU15QKTP/p1729288027846699
        if (treeNode.object instanceof GraphNode) {
          e.preventDefault();
          e.stopPropagation();
          const content = e.target.value;
          await graphStore.updateNode({
            nodeId: treeNode.object.id,
            nodeProps: {
              content: [{ type: "text", value: content }, ...treeNode.object.content],
            },
          });
          tree.setFocusedNode(treeNode.path, { anchorOffset: content.length, focusOffset: content.length }, true);
        }
      }}
    />
  );
});
