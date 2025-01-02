import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

export function WordBreakPlugin(): null {
  /*
  
  */
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerRootListener((rootElement) => {
      if (!rootElement) return;
      const style = rootElement.style;
      style.whiteSpace = "normal";
    });
  }, [editor]);

  return null;
}
