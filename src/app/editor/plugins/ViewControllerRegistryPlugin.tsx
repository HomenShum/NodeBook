import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

import { useViewStore } from "@/app/view/useViewStore";

export const ViewControllerRegistryPlugin = ({ pathToNodeStr }: { pathToNodeStr: string }) => {
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    viewStore.registerEditor(pathToNodeStr, editor);
    editor.getRootElement()?.setAttribute("data-editor-path", pathToNodeStr);

    return () => {
      viewStore.removeEditor(pathToNodeStr);
    };
  }, [pathToNodeStr, editor, viewStore]);
  return null;
};
