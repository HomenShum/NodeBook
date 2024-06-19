import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";

import { useRenderController } from "@/app/render/useRenderController";
import { relationsToPathStr } from "@/app/util";
import { useTree } from "@/app/view/Tree";

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const CreateNodeAtTopPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const tree = useTree();
  const renderController = useRenderController();
  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key === "k" && event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          tree.createChildNode().then(({ path }) => {
            renderController.setFocusedNode(relationsToPathStr(path));
          });
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [tree, editor, renderController]);
  return null;
};
