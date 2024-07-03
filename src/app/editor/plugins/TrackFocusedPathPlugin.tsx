import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { BLUR_COMMAND, COMMAND_PRIORITY_EDITOR, FOCUS_COMMAND } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { useRenderController } from "@/app/render/useRenderController";
import { useTree } from "@/app/view/TreeContext";

export const TrackFocusedPathPlugin = ({ pathToNodeStr }: { pathToNodeStr: string }) => {
  const renderController = useRenderController();
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const { treeNode } = useTreeNode();
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        action(() => {
          if (tree.selection?.type === "editor") {
            tree.setFocusedNode(null);
          }
          return false;
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        FOCUS_COMMAND,
        action(() => {
          tree.setFocusedNode(treeNode.id);
          return false;
        }),
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [pathToNodeStr, editor, renderController, tree, treeNode.id]);
  return null;
};
