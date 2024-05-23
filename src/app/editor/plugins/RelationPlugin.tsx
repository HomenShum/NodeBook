import { useSettingsStore } from "@/app/model/useSettingsStore";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";
import { useRelationAtPath } from "../../components/RelatedObject/RelatedObjectContext";
import { useViewController } from "../../controller/useViewController";
import { GraphNode } from "../../model/GraphNode";
import { useGraphStore } from "../../model/useGraphStore";
import { $getChips, $getText, getSelectionPositions } from "../utils";

export const RelationPlugin = () => {
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const viewController = useViewController();
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
        const [selectionLeft, selectionRight] = getSelectionPositions(editor).sort((a, b) =>
          a.index === b.index ? a.offset - b.offset : a.index - b.index,
        );
        // Set the relation type to the text before the cursor
        const textBefore = $getText({ index: 0, offset: 0 }, selectionLeft).trim();
        let [relationType, direction] = graphStore.getOrCreateRelationTypeByLabel(textBefore);
        relation.setType(relationType);
        if (direction === "reverse") {
          graphStore.reverseRelation(relation);
        }

        const parent = relation.to.id === object.id ? relation.from : relation.to;
        if (settingsStore.addStreamLabeledRelationsToMyLists && parent === graphStore.thoughtstreamRoot) {
          graphStore.createRelation({
            from: graphStore.thoughtstreamRoot,
            to: object,
          });
        }

        // Set the content to the content after the cursor and focus
        const chipsRight = $getChips(selectionRight);
        if (chipsRight.length) {
          chipsRight[0].value = chipsRight[0].value.trimStart(); // Remove leading whitespace
        }
        object.setContent(chipsRight);
        viewController.setFocusedNode(pathToNodeStr);
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [graphStore, settingsStore, viewController, editor, object, relation, pathToNodeStr]);
  return null;
};
