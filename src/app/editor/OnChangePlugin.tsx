import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { EditorState } from "lexical";
import { useEffect } from "react";

interface Props {
  onChange: (newState: EditorState) => void;
}

export const OnChangePlugin = ({ onChange }: Props) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const unsubscribe = editor.registerUpdateListener(({ editorState }) => {
      onChange(editorState);
    });
    return unsubscribe;
  }, [editor, onChange]);
  return null;
};
