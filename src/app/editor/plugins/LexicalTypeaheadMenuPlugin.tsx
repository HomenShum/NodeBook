/**
 * Ported from Lexical GitHub repo due to components not being directly exportable.
 * Source: https://github.com/facebook/lexical/blob/main/packages/lexical-react/src/LexicalTypeaheadMenuPlugin.tsx
 *
 * Modified to:
 * 1. Add key down listener for semicolon (;) to trigger dropdown menu.
 * 2. Handle edge case for empty Lexical node positioning.
 */


import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  CommandListenerPriority,
  KEY_DOWN_COMMAND,
  LexicalEditor,
  RangeSelection,
  TextNode,
} from "lexical";
import React, { RefObject, useEffect, useRef } from "react";

import {
  LexicalMenu,
  MenuEventTrigger,
  MenuOption,
  MenuResolution,
  MenuState,
  useMenuAnchorRef,
  type MenuRenderFn,
  type MenuStateHandler,
} from "@/app/components/UIPrimitives/LexicalMenu";

const START_TRANSITION = "startTransition";
// Webpack + React 17 fails to compile on the usage of `React.startTransition` or
// `React["startTransition"]` even if it's behind a feature detection of
// `"startTransition" in React`. Moving this to a constant avoids the issue :/
function startTransition(callback: () => void) {
  if (START_TRANSITION in React) {
    React[START_TRANSITION](callback);
  } else {
    callback();
  }
}

function getTextUpToAnchor(selection: RangeSelection): string | null {
  const anchor = selection.anchor;
  if (anchor.type !== "text") {
    return null;
  }
  const anchorNode = anchor.getNode();
  if (!anchorNode.isSimpleText()) {
    return null;
  }
  const anchorOffset = anchor.offset;
  return anchorNode.getTextContent().slice(0, anchorOffset);
}

function tryToPositionRange(leadOffset: number, range: Range, editorWindow: Window): boolean {
  const domSelection = editorWindow.getSelection();
  if (domSelection === null || !domSelection.isCollapsed) {
    return false;
  }
  const anchorNode = domSelection.anchorNode;
  const startOffset = leadOffset;
  const endOffset = domSelection.anchorOffset;

  if (anchorNode == null || endOffset == null) {
    return false;
  }

  try {
    range.setStart(anchorNode, startOffset);
    range.setEnd(anchorNode, endOffset);
  } catch (error) {
    return false;
  }

  return true;
}

function getQueryTextForSearch(editor: LexicalEditor): string | null {
  let text = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }
    text = getTextUpToAnchor(selection);
  });
  return text;
}

function isSelectionOnEntityBoundary(editor: LexicalEditor, offset: number): boolean {
  if (offset !== 0) {
    return false;
  }
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchor = selection.anchor;
      const anchorNode = anchor.getNode();
      const prevSibling = anchorNode.getPreviousSibling();
      return $isTextNode(prevSibling) && prevSibling.isTextEntity();
    }
    return false;
  });
}

export type TypeaheadMenuPluginProps<TOption extends MenuOption> = {
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
    matchingString: string,
  ) => void;
  options: Array<TOption>;
  menuRenderFn: MenuRenderFn<TOption>;
  menuState: MenuState;
  menuStateHandler: MenuStateHandler;
  onOpen?: (resolution: MenuResolution) => void;
  onClose?: () => void;
  anchorClassName?: string;
  commandPriority?: CommandListenerPriority;
  parent?: HTMLElement;
  boundaryRef?: RefObject<HTMLDivElement>;
};

export function LexicalTypeaheadMenuPlugin<TOption extends MenuOption>({
  options,
  onSelectOption,
  menuRenderFn,
  menuState,
  menuStateHandler,
  anchorClassName,
  commandPriority = COMMAND_PRIORITY_LOW,
  parent,
  boundaryRef,
}: TypeaheadMenuPluginProps<TOption>): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  // Trigger -> Escape/Click Away -> Trigger to re-enable dropdown (autocomplete + mentions) when not on Always Autocomplete mode
  const typedSinceLastFocusedRef = useRef(false);

  const anchorElementRef = useMenuAnchorRef(
    menuState,
    menuStateHandler,
    menuState.isOpen && options.length > 0,
    anchorClassName,
    boundaryRef,
    parent,
  );

  useEffect(() => {
    const updateListener = () => {
      editor.getEditorState().read(() => {
        const editorWindow = editor._window || window;
        const range = editorWindow.document.createRange();
        const selection = $getSelection();
        const text = getQueryTextForSearch(editor);
        if (
          !$isRangeSelection(selection) ||
          !selection.isCollapsed() ||
          text === null ||
          range === null ||
          !typedSinceLastFocusedRef.current
        ) {
          menuStateHandler(MenuEventTrigger.HIDE_MENU_ON_BLUR);
          return;
        }

        const match = menuStateHandler(MenuEventTrigger.SHOW_MATCHING_TEXT, text);
        if (match !== null && !isSelectionOnEntityBoundary(editor, match.leadOffset)) {
          const isRangePositioned = tryToPositionRange(match.leadOffset, range, editorWindow);
          if (isRangePositioned !== null) {
            startTransition(() => {
              const resolution = {
                getRect: () => range.getBoundingClientRect(),
                match: match,
              };
              menuStateHandler(MenuEventTrigger.SHOW_WITH_RESOLUTION, undefined, resolution);
            });
            return;
          }
        }
        menuStateHandler(MenuEventTrigger.HIDE_MENU_ON_BLUR);
      });
    };
    const removeUpdateListener = editor.registerUpdateListener(updateListener);

    return () => {
      removeUpdateListener();
    };
  }, [editor, typedSinceLastFocusedRef, menuStateHandler]);

  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        menuStateHandler(MenuEventTrigger.HIDE_MENU_ON_ESCAPE);
        return true;
      }
      // Rules: @ behavior for mentions dropdown
      if (!menuState.isOpen && e.key === "@") {
        // Note: @ takes precedence due to shift key
        menuStateHandler(MenuEventTrigger.SHOW_MENTIONS);
        return true;
      }
      // Rule: Only show autocomplete for single-character inputs and exclude modifier keys
      if (e.key.length !== 1 || e.key === " " || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
        // let other plugins handle modifier key commands
        return false;
      }

      typedSinceLastFocusedRef.current = true;
      const editorWindow = editor._window || window;
      const range = editorWindow.document.createRange();

      const text = getQueryTextForSearch(editor);
      let match = null;
      // Rule: Show Recently Created on Semicolon on empty node
      if (e.key === ";" && text === null) {
        match = menuStateHandler(MenuEventTrigger.SHOW_RECENTLY_CREATED);
        e.preventDefault();
      } else {
        match = menuStateHandler(MenuEventTrigger.SHOW_MATCHING_TEXT, text ?? "");
      }
      const menuPosition = range.getBoundingClientRect();
      if (menuPosition.x === 0 && menuPosition.y === 0) {
        const input = document.activeElement as HTMLInputElement;
        const inputRect = input.getBoundingClientRect();
        startTransition(() => {
          const resolution: MenuResolution = {
            getRect: () => (menuPosition.x !== 0 || menuPosition.y !== 0 ? menuPosition : inputRect),
            match: match || undefined,
          };
          menuStateHandler(MenuEventTrigger.SHOW_WITH_RESOLUTION, undefined, resolution);
        });
        return true;
      }

      return false;
    };

    const handleBlur = () => {
      menuStateHandler(MenuEventTrigger.HIDE_MENU_ON_BLUR);
      typedSinceLastFocusedRef.current = false;
      return false;
    };

    return mergeRegister(
      editor.registerCommand(KEY_DOWN_COMMAND, handleKeyDown, COMMAND_PRIORITY_NORMAL),
      editor.registerCommand(BLUR_COMMAND, handleBlur, COMMAND_PRIORITY_NORMAL),
    );
  }, [editor, menuState, typedSinceLastFocusedRef, menuStateHandler]);

  return editor && menuState.isOpen && menuState.resolution ? (
    <LexicalMenu
      close={() => menuStateHandler(MenuEventTrigger.HIDE_MENU_ON_BLUR)}
      menuState={menuState}
      editor={editor}
      anchorElementRef={anchorElementRef}
      options={options}
      menuRenderFn={menuRenderFn}
      shouldSplitNodeWithQuery={true}
      onSelectOption={onSelectOption}
      commandPriority={commandPriority}
    />
  ) : null;
}
