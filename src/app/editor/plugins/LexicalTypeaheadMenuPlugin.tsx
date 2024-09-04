/**
 * Ported from Lexical GitHub repo due to components not being directly exportable.
 * Source: https://github.com/facebook/lexical/blob/main/packages/lexical-react/src/LexicalTypeaheadMenuPlugin.tsx
 * 
 * Modified to:
 * 1. Add key down listener for semicolon (;) to trigger dropdown menu.
 * 2. Handle edge case for empty Lexical node positioning.
 */


import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  CommandListenerPriority, KEY_DOWN_COMMAND, LexicalEditor,
  RangeSelection,
  TextNode
} from 'lexical';
import React, { useCallback, useEffect, useState } from 'react';

import {
  LexicalMenu,
  MenuOption,
  TriggerType,
  useMenuAnchorRef,
  type MenuRenderFn,
  type MenuResolution,
  type MenuTextMatch,
  type TriggerFn,
} from '@/app/components/UIPrimitives/LexicalMenu';


const START_TRANSITION = 'startTransition';
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
  if (anchor.type !== 'text') {
    return null;
  }
  const anchorNode = anchor.getNode();
  if (!anchorNode.isSimpleText()) {
    return null;
  }
  const anchorOffset = anchor.offset;
  return anchorNode.getTextContent().slice(0, anchorOffset);
}

function tryToPositionRange(
  leadOffset: number,
  range: Range,
  editorWindow: Window,
): boolean {
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

function isSelectionOnEntityBoundary(
  editor: LexicalEditor,
  offset: number,
): boolean {
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
  onQueryChange: (matchingString: string | null) => void;
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
    matchingString: string,
  ) => void;
  options: Array<TOption>;
  menuRenderFn: MenuRenderFn<TOption>;
  triggerFn: TriggerFn;
  onOpen?: (resolution: MenuResolution) => void;
  onClose?: () => void;
  anchorClassName?: string;
  commandPriority?: CommandListenerPriority;
  parent?: HTMLElement;

};

export function LexicalTypeaheadMenuPlugin<TOption extends MenuOption>({
  options,
  onQueryChange,
  onSelectOption,
  onOpen,
  onClose,
  menuRenderFn,
  triggerFn,
  anchorClassName,
  commandPriority = COMMAND_PRIORITY_LOW,
  parent,

}: TypeaheadMenuPluginProps<TOption>): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [resolution, setResolution] = useState<MenuResolution | null>(null);
  const anchorElementRef = useMenuAnchorRef(
    resolution,
    setResolution,
    anchorClassName,
    parent,
  );

  const closeTypeahead = useCallback(() => {
    setResolution(null);
    if (onClose != null && resolution !== null) {
      onClose();
    }
  }, [onClose, resolution]);

  const openTypeahead = useCallback(
    (res: MenuResolution) => {
      console.log("[openTypeahead] menu resolution", res);
      setResolution(res);
      if (onOpen != null && resolution === null) {
        onOpen(res);
      }
    },
    [onOpen, resolution],
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
          range === null
        ) {
          closeTypeahead();
          return;
        }

        const match = triggerFn(text, TriggerType.SHOW_MATCHING_TEXT);

        onQueryChange(match ? match.matchingString : null);

        if (
          match !== null &&
          !isSelectionOnEntityBoundary(editor, match.leadOffset)
        ) {
          const isRangePositioned = tryToPositionRange(
            match.leadOffset,
            range,
            editorWindow,
          );
          if (isRangePositioned !== null) {


            startTransition(() =>
              openTypeahead({
                getRect: () => range.getBoundingClientRect(),
                match: match,
              }),
            );
            return;
          }
        }
        closeTypeahead();
      });
    };
    const removeUpdateListener = editor.registerUpdateListener(updateListener);

    return () => {
      removeUpdateListener();
    };
  }, [
    editor,
    triggerFn,
    onQueryChange,
    resolution,
    closeTypeahead,
    openTypeahead,
  ]);

  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // only trigger on semicolon and if there is no text in the editor
      if (e.key !== ';') return false;
      const text = getQueryTextForSearch(editor);
      if (text !== null) return false;

      e.preventDefault();
      const editorWindow = editor._window || window;
      const range = editorWindow.document.createRange();
      const selection = $getSelection();

      if (!$isRangeSelection(selection) || !selection.isCollapsed() || range === null) {
        closeTypeahead();
        return true;
      }

      const match = triggerFn('', TriggerType.SHOW_RECENTLY_CREATED);
      onQueryChange(match ? match.matchingString : null);

      if (!match || isSelectionOnEntityBoundary(editor, match.leadOffset)) {
        closeTypeahead();
        return true;
      }

      const isRangePositioned = tryToPositionRange(match.leadOffset, range, editorWindow);
      if (!isRangePositioned) {
        closeTypeahead();
        return true;
      }

      const menuPosition = range.getBoundingClientRect();
      if (menuPosition.x !== 0 || menuPosition.y !== 0) {
        return true;
      }

      const input = document.activeElement;
      if (!(input instanceof HTMLElement)) {
        return true;
      }

      // handle edge case where dropdown apppears on top left (x=0, y=0) when 
      // lexical node is empty, dropdown should appear below the input
      const inputRect = input.getBoundingClientRect();
      startTransition(() => openTypeahead({
        getRect: () => inputRect,
        match: match,
      }));

      return true;
    };

    return (
      editor.registerCommand(KEY_DOWN_COMMAND, handleKeyDown, COMMAND_PRIORITY_NORMAL)
    );
  }, [editor, triggerFn, onQueryChange, closeTypeahead, openTypeahead]);

  return resolution === null || editor === null ? null : (
    <LexicalMenu
      close={closeTypeahead}
      resolution={resolution}
      editor={editor}
      anchorElementRef={anchorElementRef}
      options={options}
      menuRenderFn={menuRenderFn}
      shouldSplitNodeWithQuery={true}
      onSelectOption={onSelectOption}
      commandPriority={commandPriority}
    />
  );
}

export { MenuOption, MenuRenderFn, MenuResolution, MenuTextMatch, TriggerFn };
