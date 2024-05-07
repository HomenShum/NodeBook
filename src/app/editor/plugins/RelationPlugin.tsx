import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND, LexicalEditor } from "lexical";
import { useEffect } from "react";
import { useRelationAtPath } from "../../components/RelatedObject/RelatedObjectContext";
import { useViewController } from "../../controller/useViewController";
import { GraphNode } from "../../model/GraphNode";
import { useGraphStore } from "../../store/useGraphStore";

/**
 * Returns the text from the start of the editor to the left side of the selection.
 * If there's no selection, returns null.
 */
function getTextBeforeSelection(editor: LexicalEditor): string | null {
  return editor.getEditorState().read(() => {
    // Get nodes up to and including the selection start node
    const selection = $getSelection();
    if (!selection) return null;
    const points = selection.getStartEndPoints();
    if (!points) return null;
    const selectionStartNode = selection.getNodes()[0];
    if (!selectionStartNode) return null;
    const nodesBeforeSelection = selectionStartNode.getPreviousSiblings();
    // Convert to text
    const offset = selection.isBackward() ? points[1].offset : points[0].offset;
    return (
      nodesBeforeSelection.map((node) => node.getTextContent()).join("") +
      selectionStartNode.getTextContent().slice(0, offset)
    );
  });
}

export const RelationPlugin = () => {
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

        // After use presses :, we trigger logic to update the relation type to whatever the user was typing.
        // There are exceptions, though. We don't do anything if:
        // 1. The existing relation is already some special (non-child) relationship
        // 2. The text in the editor contains non-plain text (e.g. mentions, etc.)

        // Only trigger logic when current node is a regular child of the rendered parent
        if (relation.relationType.id != graphStore.relationTypesById.child.id || relation.to.id != object.id) {
          return false;
        }

        let textBeforeSelection = getTextBeforeSelection(editor);
        if (textBeforeSelection === null) {
          // If editorText is null here, indicates that the editor contains non-plain text, so we bail
          return false;
        }
        textBeforeSelection = textBeforeSelection.trim();

        let relationType = graphStore.getOrCreateRelationTypeByLabel(textBeforeSelection);
        relation.setType(relationType);
        object.setContent("");
        viewController.setFocusedNode(pathToNodeStr);

        event.preventDefault();
        event.stopPropagation();
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [graphStore, viewController, editor, object, relation, pathToNodeStr]);
  return null;
};
