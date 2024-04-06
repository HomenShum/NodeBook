import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { Bullet } from "../model/OutlineBullet";
import { useViewStore } from "../store/useViewStore";

export const ViewStoreRegistryPlugin = ({ bullet }: { bullet: Bullet }) => {
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    viewStore.registerEditor(bullet, editor);
    return () => {
      viewStore.removeEditor(bullet);
    };
  }, [bullet, editor, viewStore]);
  return null;
};
