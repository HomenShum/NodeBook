import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { GraphNodeView } from "../model/GraphNodeView";
import { useViewStore } from "../store/useViewStore";

interface Props {
  nodeView: GraphNodeView;
}

export const ViewStoreRegistryPlugin = ({ nodeView }: Props) => {
  const viewStore = useViewStore();
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    viewStore.registerEditor(nodeView, editor);
    return () => {
      viewStore.removeEditor(nodeView);
    };
  }, [nodeView, editor, viewStore]);
  return null;
};
