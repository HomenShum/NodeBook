import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useContext, useEffect } from "react";
import { GraphNodeView } from "../model/GraphNodeView";
import { ViewStoreContext } from "../store/outline";

interface Props {
  nodeView: GraphNodeView;
}

export const ViewStoreRegistryPlugin = ({ nodeView }: Props) => {
  const viewStore = useContext(ViewStoreContext);
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    viewStore.registerEditor(nodeView, editor);
    return () => {
      viewStore.removeEditor(nodeView);
    };
  }, [nodeView, editor, viewStore]);
  return null;
};
