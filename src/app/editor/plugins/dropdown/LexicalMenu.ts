/**
 * A copy of LexicalMenu with some modifications to make it work with our
 * autocomplete dropdowns.
 */

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  CommandListenerPriority,
  createCommand,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_SPACE_COMMAND,
  KEY_TAB_COMMAND,
  LexicalCommand,
  LexicalEditor,
  TextNode,
} from "lexical";
import {
  MutableRefObject,
  ReactPortal,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MentionTypeaheadOption } from "@/app/editor/plugins/dropdown/MentionDropdown";
import { HASHTAG_SYMBOL } from "@/lib/utils";

export type MenuTextMatch = {
  leadOffset: number;
  matchingString: string;
  replaceableString: string;
};

export type MenuResolution = {
  match?: MenuTextMatch;
  getRect: () => DOMRect;
};

export const PUNCTUATION = "\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;";

export class MenuOption {
  key: string;
  ref?: MutableRefObject<HTMLElement | null>;

  constructor(key: string) {
    this.key = key;
    this.ref = { current: null };
    this.setRefElement = this.setRefElement.bind(this);
  }

  setRefElement(element: HTMLElement | null) {
    this.ref = { current: element };
  }
}

export type MenuRenderFn<TOption extends MenuOption> = (
  anchorElementRef: MutableRefObject<HTMLElement | null>,
  itemProps: {
    selectedIndex: number | null;
    selectOptionAndCleanUp: (option: TOption) => void;
    setHighlightedIndex: (index: number) => void;
    options: Array<TOption>;
  },
  matchingString: string | null,
) => ReactPortal | JSX.Element | null;

const scrollIntoViewIfNeeded = (target: HTMLElement) => {
  const typeaheadContainerNode = document.getElementById("typeahead-menu");
  if (!typeaheadContainerNode) {
    return;
  }

  const typeaheadRect = typeaheadContainerNode.getBoundingClientRect();

  if (typeaheadRect.top + typeaheadRect.height > window.innerHeight) {
    typeaheadContainerNode.scrollIntoView({
      block: "center",
    });
  }

  if (typeaheadRect.top < 0) {
    typeaheadContainerNode.scrollIntoView({
      block: "center",
    });
  }

  target.scrollIntoView({ block: "nearest" });
};

/**
 * Walk backwards along user input and forward through entity title to try
 * and replace more of the user's text with entity.
 */
function getFullMatchOffset(documentText: string, entryText: string, offset: number): number {
  let triggerOffset = offset;
  for (let i = triggerOffset; i <= entryText.length; i++) {
    if (documentText.substr(-i) === entryText.substr(0, i)) {
      triggerOffset = i;
    }
  }
  return triggerOffset;
}

/**
 * Split Lexical TextNode and return a new TextNode only containing matched text.
 * Common use cases include: removing the node, replacing with a new node.
 */
function $splitNodeContainingQuery(match: MenuTextMatch): TextNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }
  const anchor = selection.anchor;
  if (anchor.type !== "text") {
    return null;
  }
  const anchorNode = anchor.getNode();
  if (!anchorNode.isSimpleText()) {
    return null;
  }
  const selectionOffset = anchor.offset;
  const textContent = anchorNode.getTextContent().slice(0, selectionOffset);
  const characterOffset = match.replaceableString.length;
  const queryOffset = getFullMatchOffset(textContent, match.matchingString, characterOffset);
  const startOffset = selectionOffset - queryOffset;
  if (startOffset < 0) {
    return null;
  }
  let newNode;
  if (startOffset === 0) {
    [newNode] = anchorNode.splitText(selectionOffset);
  } else {
    [, newNode] = anchorNode.splitText(startOffset, selectionOffset);
  }

  return newNode;
}

// Got from https://stackoverflow.com/a/42543908/2013580
export function getScrollParent(element: HTMLElement, includeHidden: boolean): HTMLElement | HTMLBodyElement {
  let style = getComputedStyle(element);
  const excludeStaticParent = style.position === "absolute";
  const overflowRegex = includeHidden ? /(auto|scroll|hidden)/ : /(auto|scroll)/;
  if (style.position === "fixed") {
    return document.body;
  }
  for (let parent: HTMLElement | null = element; (parent = parent.parentElement); ) {
    style = getComputedStyle(parent);
    if (excludeStaticParent && style.position === "static") {
      continue;
    }
    if (overflowRegex.test(style.overflow + style.overflowY + style.overflowX)) {
      return parent;
    }
  }
  return document.body;
}

function isTriggerVisibleInNearestScrollContainer(targetElement: HTMLElement, containerElement: HTMLElement): boolean {
  const tRect = targetElement.getBoundingClientRect();
  const cRect = containerElement.getBoundingClientRect();
  return tRect.top > cRect.top && tRect.top < cRect.bottom;
}

// Reposition the menu on scroll, window resize, and element resize.
export function useDynamicPositioning(
  resolution: MenuResolution | null,
  targetElement: HTMLElement | null,
  onReposition: () => void,
  onVisibilityChange?: (isInView: boolean) => void,
) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (targetElement != null && resolution != null) {
      const rootElement = editor.getRootElement();
      const rootScrollParent = rootElement != null ? getScrollParent(rootElement, false) : document.body;
      let ticking = false;
      let previousIsInView = isTriggerVisibleInNearestScrollContainer(targetElement, rootScrollParent);
      const handleScroll = function () {
        if (!ticking) {
          window.requestAnimationFrame(function () {
            onReposition();
            ticking = false;
          });
          ticking = true;
        }
        const isInView = isTriggerVisibleInNearestScrollContainer(targetElement, rootScrollParent);
        if (isInView !== previousIsInView) {
          previousIsInView = isInView;
          if (onVisibilityChange != null) {
            onVisibilityChange(isInView);
          }
        }
      };
      const resizeObserver = new ResizeObserver(onReposition);
      window.addEventListener("resize", onReposition);
      document.addEventListener("scroll", handleScroll, {
        capture: true,
        passive: true,
      });
      resizeObserver.observe(targetElement);
      return () => {
        resizeObserver.unobserve(targetElement);
        window.removeEventListener("resize", onReposition);
        document.removeEventListener("scroll", handleScroll, true);
      };
    }
  }, [targetElement, editor, onVisibilityChange, onReposition, resolution]);
}

export const SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND: LexicalCommand<{
  index: number;
  option: MenuOption;
}> = createCommand("SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND");

export function LexicalMenu<TOption extends MenuOption>({
  close,
  editor,
  anchorElementRef,
  resolution,
  options,
  menuRenderFn,
  onSelectOption,
  shouldSplitNodeWithQuery = false,
  commandPriority = COMMAND_PRIORITY_LOW,
}: {
  close: () => void;
  editor: LexicalEditor;
  anchorElementRef: MutableRefObject<HTMLElement>;
  resolution: MenuResolution;
  options: Array<TOption>;
  shouldSplitNodeWithQuery?: boolean;
  menuRenderFn: MenuRenderFn<TOption>;
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
    matchingString: string,
  ) => void;
  commandPriority?: CommandListenerPriority;
}): JSX.Element | null {
  const [selectedIndex, setHighlightedIndex] = useState<null | number>(null);

  const matchingString = resolution.match && resolution.match.matchingString;

  // useEffect(() => {
  //   setHighlightedIndex(0);
  // }, [matchingString]);

  const selectOptionAndCleanUp = useCallback(
    (selectedEntry: TOption) => {
      editor.update(() => {
        const textNodeContainingQuery =
          resolution.match != null && shouldSplitNodeWithQuery ? $splitNodeContainingQuery(resolution.match) : null;

        onSelectOption(
          selectedEntry,
          textNodeContainingQuery,
          close,
          resolution.match ? resolution.match.matchingString : "",
        );
      });
    },
    [editor, shouldSplitNodeWithQuery, resolution.match, onSelectOption, close],
  );

  const updateSelectedIndex = useCallback(
    (index: number) => {
      const rootElem = editor.getRootElement();
      if (rootElem !== null) {
        rootElem.setAttribute("aria-activedescendant", "typeahead-item-" + index);
        setHighlightedIndex(index);
      }
    },
    [editor],
  );

  useEffect(() => {
    return () => {
      const rootElem = editor.getRootElement();
      if (rootElem !== null) {
        rootElem.removeAttribute("aria-activedescendant");
      }
    };
  }, [editor]);

  useLayoutEffect(() => {
    if (options === null) {
      setHighlightedIndex(null);
    }
    // } else if (selectedIndex === null) {
    //   updateSelectedIndex(0);
    // }
  }, [options, selectedIndex, updateSelectedIndex]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND,
        ({ option }) => {
          if (option.ref && option.ref.current != null) {
            scrollIntoViewIfNeeded(option.ref.current);
            return true;
          }

          return false;
        },
        commandPriority,
      ),
    );
  }, [editor, updateSelectedIndex, commandPriority]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand<KeyboardEvent>(
        KEY_ARROW_DOWN_COMMAND,
        (payload) => {
          const event = payload;
          if (selectedIndex === null) {
            setHighlightedIndex(0);
          } else if (options !== null && options.length && selectedIndex !== null) {
            const newSelectedIndex = selectedIndex !== options.length - 1 ? selectedIndex + 1 : 0;
            updateSelectedIndex(newSelectedIndex);
            const option = options[newSelectedIndex];
            if (option.ref != null && option.ref.current) {
              editor.dispatchCommand(SCROLL_TYPEAHEAD_OPTION_INTO_VIEW_COMMAND, {
                index: newSelectedIndex,
                option,
              });
            }
            event.preventDefault();
            event.stopImmediatePropagation();
          }
          return true;
        },
        commandPriority,
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_ARROW_UP_COMMAND,
        (payload) => {
          const event = payload;
          if (options !== null && options.length && selectedIndex !== null) {
            const newSelectedIndex = selectedIndex !== 0 ? selectedIndex - 1 : options.length - 1;
            updateSelectedIndex(newSelectedIndex);
            const option = options[newSelectedIndex];
            if (option.ref != null && option.ref.current) {
              scrollIntoViewIfNeeded(option.ref.current);
            }
            event.preventDefault();
            event.stopImmediatePropagation();
          }
          return true;
        },
        commandPriority,
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_ESCAPE_COMMAND,
        (payload) => {
          const event = payload;
          event.preventDefault();
          event.stopImmediatePropagation();
          close();
          return true;
        },
        commandPriority,
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_TAB_COMMAND,
        (payload) => {
          const event = payload;
          if (options === null || options.length === 0 || event.shiftKey) {
            return false;
          }
          event.preventDefault();
          event.stopImmediatePropagation();

          if (selectedIndex == null) {
            selectOptionAndCleanUp(options[0]);
          } else {
            selectOptionAndCleanUp(options[selectedIndex]);
          }
          return true;
        },
        commandPriority,
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_SPACE_COMMAND,
        (payload) => {
          const event = payload;
          let curSelectedIndex: number | null = selectedIndex;

          if (options === null) {
            return false;
          }
          if (curSelectedIndex === null) {
            curSelectedIndex = 0;
          }
          if (options[curSelectedIndex] == null) {
            return false;
          }
          // Only return true if the dropdown type is a hashtag mention.
          const option = options[curSelectedIndex];
          if (option instanceof MentionTypeaheadOption && option.value.trigger === HASHTAG_SYMBOL) {
            if (matchingString === " " || matchingString?.length === 0) {
              close();
              return false;
            }
            const optionIsNew = option.value.type === "new";
            // If the match is exact, complete the match. If it is inexact, create a new node.
            const matchIsExact = option.value.type === "existing" && option.value.object.text === "#" + matchingString;
            if (optionIsNew || matchIsExact) {
              event.preventDefault();
              event.stopImmediatePropagation();
              selectOptionAndCleanUp(option);
              return true;
            }
            // If the match is inexact, create a new node.
            const optionIndex = options.findIndex(
              (option) => option instanceof MentionTypeaheadOption && option.value.type === "new",
            );
            if (optionIndex !== -1) {
              event.preventDefault();
              event.stopImmediatePropagation();
              selectOptionAndCleanUp(options[optionIndex]);
              return true;
            }
          }
          return false;
        },
        commandPriority,
      ),

      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event: KeyboardEvent | null) => {
          if (!event) {
            return false;
          }
          event.preventDefault();
          event.stopImmediatePropagation();

          if (options === null) {
            return false;
          }

          if (event.ctrlKey || event.metaKey) {
            selectOptionAndCleanUp(options[options.length - 1]);
            return true;
          }

          if (selectedIndex === null || options[selectedIndex] == null) {
            close();
            return false;
          }

          selectOptionAndCleanUp(options[selectedIndex]);
          return true;
        },
        commandPriority,
      ),
    );
  }, [
    selectOptionAndCleanUp,
    close,
    editor,
    options,
    selectedIndex,
    updateSelectedIndex,
    commandPriority,
    matchingString,
  ]);

  const listItemProps = useMemo(
    () => ({
      options,
      selectOptionAndCleanUp,
      selectedIndex,
      setHighlightedIndex,
    }),
    [selectOptionAndCleanUp, selectedIndex, options],
  );

  return menuRenderFn(anchorElementRef, listItemProps, resolution.match ? resolution.match.matchingString : "");
}

export function useMenuAnchorRef(
  resolution: MenuResolution | null,
  setResolution: (r: MenuResolution | null) => void,
  className?: string,
  parent: HTMLElement = document.body,
  shouldIncludePageYOffset__EXPERIMENTAL: boolean = true,
): MutableRefObject<HTMLElement> {
  const [editor] = useLexicalComposerContext();
  const anchorElementRef = useRef<HTMLElement>(document.createElement("div"));
  const menuResizeObserverRef = useRef<ResizeObserver | null>(null);

  const positionMenu = useCallback(() => {
    const rootElement = document.body; // This is the change compared to the original LexicalMenu
    const containerDiv = anchorElementRef.current;

    const menuEle = containerDiv.firstChild as HTMLElement;
    if (rootElement !== null && resolution !== null) {
      const { left, top, width, height } = resolution.getRect();
      const pageXOffset = window.pageXOffset || window.scrollX;
      const pageYOffset = window.pageYOffset || window.scrollY;

      // Calculate viewport-relative coordinates
      const viewportLeft = left;
      const viewportTop = top;

      // Configure container with fixed positioning - this avoids affecting document overflow
      containerDiv.style.position = "fixed";
      // Add vertical spacing (20px) when positioning below to prevent overlap with node text
      containerDiv.style.top = `${viewportTop + 20}px`;
      containerDiv.style.left = `${viewportLeft}px`;
      containerDiv.style.height = `${height}px`;
      containerDiv.style.width = `${width}px`;

      if (menuEle !== null) {
        // Remove the top positioning on the menu element
        if (menuEle.style) {
          menuEle.style.top = "";
        }

        const menuRect = menuEle.getBoundingClientRect();
        const menuWidth = menuRect.width;
        const menuHeight = Math.min(menuRect.height, window.innerHeight * 0.3); // Cap at 30% of viewport
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Ensure menu stays within viewport horizontally
        if (viewportLeft + menuWidth > viewportWidth) {
          containerDiv.style.left = `${viewportWidth - menuWidth - 10}px`; // 10px buffer
        }

        // Ensure menu stays within viewport vertically
        if (viewportTop + 20 + menuHeight > viewportHeight) {
          // Position above the cursor if it would otherwise extend below viewport
          containerDiv.style.top = `${viewportTop - menuHeight}px`;
        }

        // Add a resize observer to the menu element itself to reposition when its content changes
        if (menuResizeObserverRef.current) {
          menuResizeObserverRef.current.disconnect();
        }
        menuResizeObserverRef.current = new ResizeObserver(() => {
          const newMenuRect = menuEle.getBoundingClientRect();
          const newMenuHeight = Math.min(newMenuRect.height, window.innerHeight * 0.3);

          // Only update position if necessary to stay in viewport
          if (viewportTop + 20 + newMenuHeight > viewportHeight) {
            containerDiv.style.top = `${viewportTop - newMenuHeight}px`;
          } else {
            containerDiv.style.top = `${viewportTop + 20}px`;
          }
        });
        menuResizeObserverRef.current.observe(menuEle);
      }

      if (!containerDiv.isConnected) {
        if (className != null) {
          containerDiv.className = className;
        }
        containerDiv.setAttribute("aria-label", "Typeahead menu");
        containerDiv.setAttribute("id", "typeahead-menu");
        containerDiv.setAttribute("role", "listbox");
        containerDiv.style.display = "block";
        containerDiv.style.position = "fixed";
        containerDiv.style.zIndex = "9999";
        parent.append(containerDiv);
      }
      anchorElementRef.current = containerDiv;
      rootElement.setAttribute("aria-controls", "typeahead-menu");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, resolution, className, parent]);

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (resolution !== null) {
      positionMenu();
      return () => {
        if (rootElement !== null) {
          rootElement.removeAttribute("aria-controls");
        }

        const containerDiv = anchorElementRef.current;
        if (containerDiv !== null && containerDiv.isConnected) {
          containerDiv.remove();
        }

        // Clean up the resize observer when unmounting
        if (menuResizeObserverRef.current) {
          menuResizeObserverRef.current.disconnect();
          menuResizeObserverRef.current = null;
        }
      };
    }
  }, [editor, positionMenu, resolution]);

  const onVisibilityChange = useCallback(
    (isInView: boolean) => {
      if (resolution !== null) {
        if (!isInView) {
          setResolution(null);
        }
      }
    },
    [resolution, setResolution],
  );

  useDynamicPositioning(resolution, anchorElementRef.current, positionMenu, onVisibilityChange);

  return anchorElementRef;
}

export type TriggerFn = (text: string, editor: LexicalEditor) => MenuTextMatch | null;
