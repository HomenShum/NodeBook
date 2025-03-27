import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

import logger from "@/lib/logger";

/**
 * This plugin logs an error whenever we find the editor has collapsed to a zero
 * height line. It's temporary to help us debug how we get into this state.
 *
 * Usually lexical editors always have some height. Even when they're empty, there's
 * a br inside which gives it some height. This provides a clickable area which
 * the user can click into to start editing.
 *
 * We know it's possible to get into this zero-height state because we shipped a bug where
 * we could reliably get into it. See https://linear.app/ideaflow/issue/ENT-4573/fix-ghost-bullets-that-cant-be-edited-or-clicked
 *
 * We thought we'd fixed it, but have received reports that it's still happening.
 * So we've added this plugin to log an error whenever we find the editor in this state
 * to help us debug it.
 */
export const LogCollapsedEditorPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener((editorState) => {
      // We can't actually check the height because we've added a min-height to keep
      // the editor from collapsing in prod. But we know from ENT-4573 that when the
      // editor is collapsed, it's because there's an empty span inside it.
      const span = editor.getRootElement()?.querySelector("p > span");
      if (span instanceof HTMLElement && span.innerHTML === "") {
        logger.error("In ghost bullet state", { html: editor.getRootElement()?.innerHTML });
      }
    });
  }, [editor]);

  return null;
};
