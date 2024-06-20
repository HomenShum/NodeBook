import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { $getChips, $getText, getSelectionPositions } from "@/app/editor/utils";
import { GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useRenderController } from "@/app/render/useRenderController";

export const RelationPlugin = () => {
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const renderController = useRenderController();
  const [editor] = useLexicalComposerContext();
  const { object, relation, pathToNodeStr } = useRelationAtPath();
  if (!(object instanceof GraphNode)) {
    throw new Error("Expected object to be a GraphNode");
  }
  useEffect(() => {
    return editor.registerCommand(
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
        const [selectionLeft, selectionRight] = getSelectionPositions(editor);
        // Set the relation type to the text before the cursor
        const textBefore = $getText({ from: { index: 0, offset: 0 }, to: selectionLeft }).trim();
        let [relationType, direction] = graphStore.getOrCreateRelationTypeByLabel(textBefore);
        relation.setType(relationType);
        if (direction === "reverse") {
          graphStore.reverseRelation(relation);
        }

        // Set the content to the content after the cursor and focus
        const chipsRight = $getChips(selectionRight);
        if (chipsRight.length) {
          chipsRight[0].value = chipsRight[0].value.trimStart(); // Remove leading whitespace
        }
        object.setContent(chipsRight);
        renderController.setFocusedNode(pathToNodeStr);

        // TODO: if reasonable, make this one transaction with the above
        const parent = relation.to.id === object.id ? relation.from : relation.to;
        if (settingsStore.addStreamLabeledRelationsToMyLists && parent === graphStore.thoughtstreamRoot) {
          graphStore.addRelation({
            fromId: graphStore.thoughtstreamRoot.id,
            toId: object.id,
          });
        }

        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [graphStore, settingsStore, renderController, editor, object, relation, pathToNodeStr]);
  return null;
};
