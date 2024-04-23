import { ViewType } from "@/app/controller/ViewController";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  CLEAR_EDITOR_COMMAND,
  COMMAND_PRIORITY_NORMAL,
  KEY_DOWN_COMMAND,
  LexicalEditor,
} from "lexical";
import { useEffect } from "react";
import { useRelationAtPath } from "../../components/RelatedObject/RelatedObjectContext";
import { useViewController } from "../../controller/useViewController";
import { GraphNode } from "../../model/GraphNode";
import { useGraphStore } from "../../store/useGraphStore";

function getEditorText(editor: LexicalEditor): string | null {
  let text: string | null = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.anchor.type !== "text") {
      return;
    }
    const anchorNode = selection.anchor.getNode();
    if (!anchorNode.isSimpleText()) {
      return;
    }
    text = anchorNode.getTextContent().slice(0, selection.anchor.offset);
  });
  return text;
}

export const RelationPlugin = () => {
  const graphStore = useGraphStore();
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  const { object, relation } = useRelationAtPath();
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
        if (viewController.curView != ViewType.OUTLINE) {
          // TODO: make this also work for outline side of split view?
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

        let editorText = getEditorText(editor);
        if (editorText === null) {
          // If editorText is null here, indicates that the editor contains non-plain text, so we bail
          return false;
        }
        editorText = editorText.trim();

        let relationType = graphStore.getRelationTypeByLabel(editorText);
        if (!relationType) {
          // If there isn't an existing relation type with the label, we create a new one
          relationType = graphStore.createRelationType({
            id: editorText.replace(" ", "_"),
            label: editorText,
            reverseLabel: `is ${editorText} of`,
          });
        }
        relation.setType(relationType);

        editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);

        event.preventDefault();
        event.stopPropagation();
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [graphStore, viewController, editor, object, relation]);
  return null;
};
