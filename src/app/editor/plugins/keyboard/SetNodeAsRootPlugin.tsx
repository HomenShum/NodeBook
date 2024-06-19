import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_EDITOR, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useTree } from "@/app/view/Tree";

/**
 * Plugin to set the current node as the view root when the user presses Cmd+. (Mac) or Ctrl+. (Windows).
 */
export const SetNodeAsRootPlugin = () => {
  const graphStore = useGraphStore();
  const tree = useTree();
  const [editor] = useLexicalComposerContext();
  const { pathToParentRelations, relation, pathToParentWithOrderedObjects: pathToParentNodes } = useRelationAtPath();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        const metaOrCtrl = event.metaKey || event.ctrlKey; // Command key on Mac, Ctrl key on Windows
        if (!metaOrCtrl || event.key !== ".") return false;

        const viewRoot = pathToParentNodes[0].child;
        if (viewRoot.id === graphStore.thoughtstreamRoot.id) {
          tree.setRoot([...pathToParentRelations, relation]);
        } else if (viewRoot.id === graphStore.outlineRoot.id) {
          tree.setRoot([...pathToParentRelations, relation]);
        } else {
          throw new Error("Unknown view root");
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [
    editor,
    graphStore.outlineRoot.id,
    graphStore.thoughtstreamRoot.id,
    pathToParentNodes,
    pathToParentRelations,
    relation,
    tree,
  ]);

  return null;
};
