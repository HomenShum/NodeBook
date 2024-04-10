import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { useViewStore } from "../store/useViewStore";

export const ViewStoreRegistryPlugin = ({ pathToNodeStr }: { pathToNodeStr: string }) => {
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    viewStore.registerEditor(pathToNodeStr, editor);
    return () => {
      viewStore.removeEditor(pathToNodeStr);
    };
  }, [pathToNodeStr, editor, viewStore]);
  return null;
};
