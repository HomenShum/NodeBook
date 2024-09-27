import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  KEY_BACKSPACE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_SPACE_COMMAND,
} from "lexical";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { $getChips, $getText, getSelectionPositions, matchDefaultRelationType } from "@/app/editor/utils";
import { defaultRelationTypes } from "@/app/graph/constants";
import { GraphNode } from "@/app/graph/GraphNode";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useRenderController } from "@/app/render/useRenderController";
import { useTree } from "@/app/tree/TreeContext";

export const RelationPlugin = observer(() => {
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const renderController = useRenderController();
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const { treeNode } = useTreeNode();
  if (!(treeNode.object instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }
  const object = treeNode.object;
  const relation = treeNode.relationWithParent;
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          // Only trigger after pressing colon, inside a child, next to another colon
          if (event.key !== ":") {
            return false;
          }
          if (relation.relationType.id !== defaultRelationTypes.child.id || relation.to.id !== object.id) {
            return false;
          }
          const [selectionLeft, selectionRight] = getSelectionPositions(editor);
          let textBefore = $getText({ from: { index: 0, offset: 0 }, to: selectionLeft });
          if (!settingsStore.triggerRelationOnSingleColon && !textBefore.endsWith(":")) {
            return false;
          }
          event.preventDefault();
          event.stopPropagation();

          // Set the relation type to the text before the cursor
          const graphStoreTransaction: TxCombined = [];
          let relationTypeText = textBefore.trim().replace(/:+$/, ""); //trim all colon from end
          const relationType = matchDefaultRelationType(relationTypeText);
          if (relationType) {
            graphStoreTransaction.push({
              type: "updateRelation",
              transaction: {
                relationId: relation.id,
                relationProps: { relationType },
              },
            });
          } else {
            const isInitiallyReversed = relationTypeText.endsWith(" of");
            graphStoreTransaction.push({
              type: "updateRelation",
              transaction: {
                relationId: relation.id,
                relationProps: { relationTypeLabel: relationTypeText, isInitiallyReversed },
              },
            });
          }

          // Set the content to the content after the cursor and focus
          const chipsRight = $getChips(selectionRight);
          if (chipsRight.length) {
            chipsRight[0].value = chipsRight[0].value.trimStart(); // Remove leading whitespace
          }
          graphStoreTransaction.push({
            type: "updateNode",
            transaction: {
              nodeId: object.id,
              nodeProps: { content: chipsRight },
            },
          });

          graphStore.applyCombinedTransaction(graphStoreTransaction);
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      // When the user hits backspace while selection is at the start of the editor,
      // remove the relation type and put it's label text into into the node's content.
      // From the users perspective, it'll look like the colon in front of the relation
      // type was deleted.
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          // If it's a child relation, or the selection isn't at the start, exit
          if (
            treeNode.relationWithParent.relationType.id === defaultRelationTypes.child.id &&
            treeNode.relationWithParent.to === object
          ) {
            return false;
          }
          const isSelectionAtStart = editor.getEditorState().read(() => {
            const selection = $getSelection();
            const points = selection?.getStartEndPoints();
            if (!points) {
              return false;
            }
            const [start, end] = points;
            const firstDescendant = $getRoot().getFirstDescendant();
            return (
              start.getNode() === firstDescendant &&
              end.getNode() === firstDescendant &&
              start.offset === 0 &&
              end.offset === 0
            );
          });
          if (!isSelectionAtStart) {
            return false;
          }

          // Go ahead with removing relation type and setting content

          event.preventDefault();

          const isForward = relation.to.id === object.id;
          let labelText = isForward ? relation.relationType.label : relation.relationType.reverseLabel;
          labelText += $getRoot().getTextContent().length > 0 ? " " : "";

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
            {
              type: "updateNode",
              transaction: {
                nodeId: object.id,
                nodeProps: { content: [{ type: "text", value: labelText }, ...oldContent] },
              },
            },
          ]);
          tree.setFocusedNode(treeNode.id, { anchorOffset: labelText.length, focusOffset: labelText.length });
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      editor.registerCommand(
        KEY_SPACE_COMMAND,
        (event) => {
          // Often after pressing colon to name a relation, the user will press space
          // to start typing the content. This command prevents the space from being
          // added to the content.
          const text = $getRoot().getTextContent();
          if (text.trim() === "") {
            event.preventDefault();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [
    tree,
    graphStore,
    settingsStore,
    settingsStore.triggerRelationOnSingleColon,
    renderController,
    editor,
    object,
    relation,
    treeNode.path,
    treeNode.id,
    treeNode.relationWithParent.relationType.id,
    treeNode.relationWithParent.to,
  ]);
  return null;
});
