import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { useViewController } from "../controller/useViewController";

export const ViewControllerRegistryPlugin = ({ pathToNodeStr }: { pathToNodeStr: string }) => {
  const viewController = useViewController();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    viewController.registerEditor(pathToNodeStr, editor);
    return () => {
      viewController.removeEditor(pathToNodeStr);
    };
  }, [pathToNodeStr, editor, viewController]);
  return null;
};
