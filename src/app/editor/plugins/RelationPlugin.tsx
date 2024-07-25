import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { $getRoot, COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND, KEY_SPACE_COMMAND } from "lexical";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { $getChips, $getText, getSelectionPositions } from "@/app/editor/utils";
import { GraphNode } from "@/app/graph/GraphNode";
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
          if (relation.relationType.id != graphStore.relationTypesById.child.id || relation.to.id != object.id) {
            return false;
          }
          event.preventDefault();
          event.stopPropagation();
          const graphStoreTransaction: TxCombined = [];
          const [selectionLeft, selectionRight] = getSelectionPositions(editor);
          // Set the relation type to the text before the cursor
          const textBefore = $getText({ from: { index: 0, offset: 0 }, to: selectionLeft }).trim();
          graphStoreTransaction.push({
            type: "updateRelation",
            transaction: {
              relationId: relation.id,
              relationProps: { relationTypeLabel: textBefore },
            },
          });

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

          // TODO: if reasonable, make this one transaction with the above
          const parent = relation.to.id === object.id ? relation.from : relation.to;
          if (settingsStore.addStreamLabeledRelationsToMyLists && parent === graphStore.thoughtstreamRoot) {
            graphStoreTransaction.push({
              type: "addRelation",
              transaction: {
                fromId: graphStore.thoughtstreamRoot.id,
                toId: object.id,
              },
            });
          }
          graphStore.applyCombinedTransaction(graphStoreTransaction);
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
  }, [tree, graphStore, settingsStore, renderController, editor, object, relation, treeNode.path]);
  return null;
};
