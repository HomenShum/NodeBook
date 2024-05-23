import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useViewController } from "@/app/controller/useViewController";
import { GraphNode } from "@/app/model/GraphNode";
import { useGraphStore } from "@/app/store/useGraphStore";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_LOW, PASTE_COMMAND } from "lexical";
import { useEffect } from "react";

/**
 * Plugin that allows pasting multiple lines of text into a node.
 */
export const PastePlugin = () => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const viewController = useViewController();
  const { object, relation, parent, pathToNodeStr } = useRelationAtPath();
  useEffect(() => {
    return editor.registerCommand<ClipboardEvent>(
      PASTE_COMMAND,
      (event) => {
        if (!(object instanceof GraphNode)) return false;
        const lines = event.clipboardData?.getData("Text")?.split("\n") ?? [];
        if (lines.length > 1) {
          // if the current node is empty, set the first line as its content
          if (object.text === "") {
            const line = lines.shift() ?? "";
            object.setContent(line);
          }
          // then for the remaining lines, create children positioned after the parent
          const children = lines.map((line) => graphStore.createChildNode(parent, { content: line }));
          graphStore.getRelationList(parent).move(
            children.map((c) => c.relation),
            relation,
          );
          viewController.setFocusedNode(pathToNodeStr);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [object, parent, relation, graphStore, editor, viewController, pathToNodeStr]);
  return null;
};
