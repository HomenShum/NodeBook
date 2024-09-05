import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getRoot,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  KEY_BACKSPACE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_SPACE_COMMAND,
} from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { $getChips, $getText, getSelectionPositions, matchDefaultRelationType } from "@/app/editor/utils";
import { GraphNode } from "@/app/graph/GraphNode";
import { defaultRelationTypes } from "@/app/graph/GraphStore";
import { TxCombined } from "@/app/graph/GraphTransactionTypes";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useRenderController } from "@/app/render/useRenderController";
import { useTree } from "@/app/tree/TreeContext";

export const RelationPlugin = () => {
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
          if (event.key !== ":") {
            return false;
          }
          // Only trigger logic when current node is a regular child of the rendered parent
          if (relation.relationType.id !== defaultRelationTypes.child.id || relation.to.id !== object.id) {
            return false;
          }
          event.preventDefault();
          event.stopPropagation();
          const graphStoreTransaction: TxCombined = [];
          const [selectionLeft, selectionRight] = getSelectionPositions(editor);
          // Set the relation type to the text before the cursor
          const textBefore = $getText({ from: { index: 0, offset: 0 }, to: selectionLeft }).trim();

          const relationType = matchDefaultRelationType(textBefore);
          if (relationType) {
            graphStoreTransaction.push({
              type: "updateRelation",
              transaction: {
                relationId: relation.id,
                relationProps: { relationType },
              },
            });
          } else {
            const isInitiallyReversed = textBefore.endsWith(" of");
            graphStoreTransaction.push({
              type: "updateRelation",
              transaction: {
                relationId: relation.id,
                relationProps: { relationTypeLabel: textBefore, isInitiallyReversed },
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
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          // When the user hits backspace right after creating a relation (or just on an empty relation)
          // we want to remove the relation and make the label the content of the node
          const text = $getRoot().getTextContent();
          if (text.trim() === "" && relation.relationType.id !== defaultRelationTypes.child.id) {
            event.preventDefault();
            const isForward = relation.to.id === object.id;
            const label = isForward ? relation.relationType.label : relation.relationType.reverseLabel;
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
                  nodeProps: { content: [{ type: "text", value: label + ":" }] },
                },
              },
            ]);
            return true;
          }
          return false;
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
  }, [tree, graphStore, settingsStore, renderController, editor, object, relation, treeNode.path]);
  return null;
};
