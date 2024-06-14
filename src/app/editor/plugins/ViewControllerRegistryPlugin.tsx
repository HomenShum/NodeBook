import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

import { useRenderController } from "@/app/render/useRenderController";

export const ViewControllerRegistryPlugin = ({ pathToNodeStr }: { pathToNodeStr: string }) => {
  const renderController = useRenderController();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    renderController.registerEditor(pathToNodeStr, editor);
    editor.getRootElement()?.setAttribute("data-editor-path", pathToNodeStr);

    return () => {
      renderController.removeEditor(pathToNodeStr);
    };
  }, [pathToNodeStr, editor, renderController]);
  return null;
};
