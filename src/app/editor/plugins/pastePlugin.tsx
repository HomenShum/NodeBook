import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_LOW, PASTE_COMMAND } from "lexical";
import { useEffect } from "react";

import { useRelationAtPath } from "@/app/components/RelatedObject/RelatedObjectContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";

/**
 * Plugin that allows pasting multiple lines of text into a node.
 */
export const PastePlugin = () => {
  const graphStore = useGraphStore();
  const [editor] = useLexicalComposerContext();
  const renderController = useRenderController();
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
          Promise.all(
            lines.map((line) =>
              graphStore.addChildNode({
                parentId: parent.id,
                nodeProps: { content: line },
              }),
            ),
          ).then((children) => {
            graphStore.getRelationList(parent).move(
              children.map((c) => c.relation),
              relation,
            );
            renderController.setFocusedNode(pathToNodeStr);
          });
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [object, parent, relation, graphStore, editor, renderController, pathToNodeStr]);
  return null;
};
