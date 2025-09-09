import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextFormatType,
} from "lexical";
import { Bold, CaseLower, CaseUpper, Code, Italic, Palette, Strikethrough, Underline } from "lucide-react";
import {
  createContext,
  MouseEvent,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { modKeyName } from "@/app/hotkeys";
import { cn } from "@/lib/utils";

import { ColorPicker } from "./ColorPickerPlugin";

import styles from "./FormattingMenuPlugin.module.css";

/**
 * This plugin handles the floating text formatting menu that appears when users select text.
 *
 * The menu provides quick access to common text formatting options like bold, italic,
 * underline, strikethrough, code, subscript, and superscript. It automatically positions
 * itself above the selected text and tracks selection changes to show/hide appropriately.
 *
 * Details:
 * - Only one selection menu can be active at a time across the editor
 * - The menu appears on text selection and disappears when selection is cleared
 * - Clicking outside the editor or losing focus hides the menu
 * - Menu buttons show active state for currently applied formatting
 * - Uses a context provider to manage menu state and prevent conflicts with other menus
 */

// Context to manage active menu state
interface ActiveMenuContextType {
  activeMenu: (() => void) | null;
  setActiveMenu: (menu: (() => void) | null) => void;
}

const ActiveMenuContext = createContext<ActiveMenuContextType>({
  activeMenu: null,
  setActiveMenu: () => {},
});

const ActiveMenuProvider = ({ children }: { children: ReactNode }) => {
  const [activeMenu, setActiveMenu] = useState<(() => void) | null>(null);

  return <ActiveMenuContext.Provider value={{ activeMenu, setActiveMenu }}>{children}</ActiveMenuContext.Provider>;
};

const useActiveMenu = () => useContext(ActiveMenuContext);

// Format options for the selection menu
const FORMAT_OPTIONS = [
  {
    format: "bold" as const,
    icon: <Bold size={14} style={{ color: "var(--gray-11)" }} />,
    label: "Bold",
    hotkey: `${modKeyName}+B`,
  },
  {
    format: "italic" as const,
    icon: <Italic size={14} style={{ color: "var(--gray-11)" }} />,
    label: "Italic",
    hotkey: `${modKeyName}+I`,
  },
  {
    format: "underline" as const,
    icon: <Underline size={14} style={{ color: "var(--gray-11)" }} />,
    label: "Underline",
    hotkey: `${modKeyName}+U`,
  },
  {
    format: "strikethrough" as const,
    icon: <Strikethrough size={14} style={{ color: "var(--gray-11)" }} />,
    label: "Strikethrough",
    hotkey: "",
  },
  {
    format: "code" as const,
    icon: <Code size={14} style={{ color: "var(--gray-11)" }} />,
    label: "Code",
    hotkey: `${modKeyName}+E`,
  },
  {
    format: "uppercase" as const,
    icon: <CaseUpper size={18} style={{ color: "var(--gray-11)" }} />,
    label: "Uppercase",
    hotkey: "",
  },
  {
    format: "lowercase" as const,
    icon: <CaseLower size={18} style={{ color: "var(--gray-11)" }} />,
    label: "Lowercase",
    hotkey: "",
  },
];

// Utility functions extracted from component
function updateMenuPosition(
  range: Range,
  isOpen: boolean,
  activateMenu: () => void,
  hideMenu: () => void,
  setSelectionRect: (rect: DOMRect | null) => void,
  setIsOpen: (open: boolean) => void,
) {
  // Only proceed if we have a valid selection rectangle
  if (range.getBoundingClientRect().width > 0 || range.getBoundingClientRect().height > 0) {
    const rect = range.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const top = rect.top;

    setSelectionRect(new DOMRect(centerX, top, 0, 0));

    if (!isOpen) {
      activateMenu();
      setIsOpen(true);
    }
  } else {
    hideMenu();
  }
}

function handleSelectionComplete(
  editorRef: { current: any },
  hideMenu: () => void,
  onUpdatePosition: (range: Range) => void,
  pendingSelectionUpdate: { current: number | null },
) {
  if (pendingSelectionUpdate.current) {
    clearTimeout(pendingSelectionUpdate.current);
  }

  // Small delay to ensure selection is stable
  pendingSelectionUpdate.current = window.setTimeout(() => {
    const selection = window.getSelection();
    const editorElement = editorRef.current.getRootElement();

    // Hide menu if there's no selection or it's collapsed
    if (!selection || selection.isCollapsed || selection.toString().trim() === "") {
      hideMenu();
      return;
    }

    // Get the current range if it exists
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    // Hide menu if range is invalid or outside our editor
    if (!range || !editorElement?.contains(range.commonAncestorContainer)) {
      hideMenu();
      return;
    }

    // Check if the selection actually contains visible text
    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) {
      hideMenu();
      return;
    }

    // Only show the menu if we have a valid selection with visible text
    onUpdatePosition(range);
  }, 50); // Small delay to ensure selection is stable
}

function handleFormatClick(
  format: TextFormatType,
  e: MouseEvent,
  editor: any,
  setSelectedFormats: (value: SetStateAction<Set<TextFormatType>>) => void,
) {
  e.preventDefault();
  e.stopPropagation();

  // First try to restore the selection from Lexical
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection) && !selection.isCollapsed()) {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);

      // Update selected formats
      setSelectedFormats((prev) => {
        const newFormats = new Set(prev);
        if (newFormats.has(format)) {
          newFormats.delete(format);
        } else {
          newFormats.add(format);
        }
        return newFormats;
      });
    }
  });

  // Keep focus on editor
  editor.focus();

  // Update the selection state
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
      // Re-apply the selection to ensure it's still valid
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

function handleSelectionChange(
  editor: any,
  hideMenu: () => void,
  isOpen: boolean,
  setSelectedFormats: (value: SetStateAction<Set<TextFormatType>>) => void,
  setSelectionRect: (value: SetStateAction<DOMRect | null>) => void,
  setIsOpen: (value: SetStateAction<boolean>) => void,
  isMounted: { current: boolean },
) {
  if (!isMounted.current) return false;

  const selection = $getSelection();
  const domSelection = window.getSelection();

  // Check if editor has focus
  const editorElement = editor.getRootElement();
  const hasFocus =
    document.activeElement === editorElement ||
    (editorElement?.contains(document.activeElement) &&
      document.activeElement?.getAttribute("contenteditable") === "true");

  // Check if we have a valid selection with content
  const hasValidSelection =
    hasFocus &&
    selection &&
    $isRangeSelection(selection) &&
    !selection.isCollapsed() &&
    domSelection &&
    !domSelection.isCollapsed &&
    domSelection.toString().trim() !== "";

  if (!hasValidSelection) {
    // Hide menu when there's no valid selection or editor doesn't have focus
    hideMenu();
    return false;
  }

  // Verify the selection is within our editor
  const range = domSelection.rangeCount > 0 ? domSelection.getRangeAt(0) : null;
  if (!range || !editorElement?.contains(range.commonAncestorContainer)) {
    hideMenu();
    return false;
  }

  // Update active formats
  const activeFormats = new Set<TextFormatType>();
  FORMAT_OPTIONS.forEach(({ format }) => {
    if (selection.hasFormat(format)) {
      activeFormats.add(format);
    }
  });
  setSelectedFormats(activeFormats);

  // Update selection rectangle
  const rects = range.getClientRects();
  if (rects.length > 0) {
    const firstRect = rects[0];
    const lastRect = rects[rects.length - 1];
    const centerX = (firstRect.left + lastRect.right) / 2;
    const top = Math.min(firstRect.top, lastRect.top);

    setSelectionRect(new DOMRect(centerX, top, 0, 0));

    // Make sure menu is visible when we have a valid selection
    if (!isOpen) {
      setIsOpen(true);
    }
  } else {
    // No valid rectangles, hide menu
    hideMenu();
  }

  return false;
}

export function FormattingMenuPlugin() {
  return (
    <ActiveMenuProvider>
      <FormattingMenu />
    </ActiveMenuProvider>
  );
}

function FormattingMenu(): JSX.Element | null {
  // All state and refs declared at the top
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<Set<TextFormatType>>(new Set());
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ x: number; y: number } | null>(null);
  const isSelectingRef = useRef(false);
  const pendingSelectionUpdate = useRef<number | null>(null);
  const isMounted = useRef(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const hideMenuRef = useRef<() => void>();
  const editorRef = useRef(editor);
  const { activeMenu, setActiveMenu } = useActiveMenu();

  // Keep editor ref updated
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Hide menu helper
  const hideMenu = useCallback(() => {
    if (isMounted.current) {
      setIsOpen(false);
      setSelectionRect(null);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = undefined;
      }
    }
  }, []);

  // Store the latest hideMenu in a ref
  useEffect(() => {
    hideMenuRef.current = hideMenu;
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [hideMenu]);

  // Close other menus and set this as active
  const activateMenu = useCallback(() => {
    if (activeMenu && activeMenu !== hideMenu) {
      activeMenu();
    }
    setActiveMenu(hideMenu);
  }, [activeMenu, hideMenu, setActiveMenu]);

  // Track if component is mounted
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;

      // Clear any pending timeouts
      if (pendingSelectionUpdate.current) {
        clearTimeout(pendingSelectionUpdate.current);
        pendingSelectionUpdate.current = null;
      }

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = undefined;
      }

      // Clear active menu reference if this is the active menu
      if (activeMenu === hideMenuRef.current) {
        setActiveMenu(null);
      }
    };
  }, [activeMenu, setActiveMenu]);

  // Helper to update menu position based on selection range - using extracted function
  const onUpdatePosition = useCallback(
    (range: Range) => {
      updateMenuPosition(range, isOpen, activateMenu, hideMenu, setSelectionRect, setIsOpen);
    },
    [isOpen, activateMenu, hideMenu],
  );

  // Handle selection changes after mouseup - using extracted function
  const onSelectionComplete = useCallback(() => {
    handleSelectionComplete(editorRef, hideMenu, onUpdatePosition, pendingSelectionUpdate);
  }, [hideMenu, onUpdatePosition]);

  // Handle mouse up to detect selection end
  const handleMouseUp = useCallback(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      onSelectionComplete();
    }
  }, [onSelectionComplete]);

  // Handle mouse down for selection
  const handleMouseDown = useCallback(() => {
    isSelectingRef.current = true;
  }, []);

  // Handle format button clicks - using extracted function
  const onFormatClick = useCallback(
    (format: TextFormatType, e: MouseEvent) => {
      handleFormatClick(format, e, editor, setSelectedFormats);
    },
    [editor],
  );

  // Handle color picker button click
  const onColorPickerClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Use the selection rect to position below the selected text
      if (selectionRect) {
        const centerX = selectionRect.left + window.scrollX;
        // Position below the selection with some offset
        const bottomY = selectionRect.top + window.scrollY + 30; // 30px below selection

        setIsOpen(false);
        setColorPickerPosition({ x: centerX, y: bottomY });
        setShowColorPicker(true);
      }
    },
    [selectionRect],
  );

  // Handle color picker close
  const onColorPickerClose = useCallback(() => {
    setShowColorPicker(false);
    setColorPickerPosition(null);
  }, []);

  // Update selected formats when selection changes
  useEffect(() => {
    if (!isMounted.current) return;

    const updateSelectedFormats = () => {
      if (!isMounted.current) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        hideMenu();
        return;
      }

      const range = selection.getRangeAt(0);
      if (range.collapsed) {
        hideMenu();
        return;
      }

      // Check if selection is within our editor
      const editorElement = editor.getRootElement();
      if (!editorElement || !editorElement.contains(range.commonAncestorContainer)) {
        hideMenu();
        return;
      }

      const newFormats = new Set<TextFormatType>();

      // Check which formats are active in the selection
      FORMAT_OPTIONS.forEach(({ format }) => {
        if (document.queryCommandState(format)) {
          newFormats.add(format);
        }
      });

      setSelectedFormats(newFormats);
    };

    // Add with capture to ensure we catch all selection changes
    document.addEventListener("selectionchange", updateSelectedFormats, true);

    return () => {
      document.removeEventListener("selectionchange", updateSelectedFormats, true);
    };
  }, [editor, hideMenu]);

  // Handle selection changes from Lexical - using extracted function
  const onLexicalSelectionChange = useCallback(() => {
    return handleSelectionChange(editor, hideMenu, isOpen, setSelectedFormats, setSelectionRect, setIsOpen, isMounted);
  }, [editor, hideMenu, isOpen]);

  // Set up event listeners
  useEffect(() => {
    if (!isMounted.current) return;

    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      if (!isMounted.current) return;

      const target = event.target as HTMLElement;

      // Don't hide if clicking on the menu or its buttons
      const isMenuButton = target.closest("[data-selection-menu-button]");
      if (isMenuButton) return;

      // If click is outside editor, hide menu
      if (!editorElement.contains(target)) {
        hideMenu();
      }
    };

    // Track editor focus
    const handleFocus = () => {
      // No need to do anything special on focus
    };

    const handleBlur = () => {
      // Hide menu when editor loses focus
      hideMenu();
    };

    // Add event listeners
    const addEventListener = <K extends keyof DocumentEventMap>(
      type: K,
      listener: (this: Document, ev: DocumentEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions,
    ) => {
      document.addEventListener(type, listener, options);
      return () => document.removeEventListener(type, listener, options);
    };

    const cleanupFns = [
      addEventListener("mousedown", handleMouseDown),
      addEventListener("mouseup", handleMouseUp),
      addEventListener("mousedown", handleDocumentClick, true), // Use capture
      addEventListener("focusin", handleFocus, true),
      addEventListener("focusout", handleBlur, true),
    ];

    // Also listen for editor blur
    editorElement.addEventListener("blur", handleBlur);
    cleanupFns.push(() => editorElement.removeEventListener("blur", handleBlur));

    return () => {
      cleanupFns.forEach((cleanup) => cleanup());

      if (pendingSelectionUpdate.current) {
        clearTimeout(pendingSelectionUpdate.current);
        pendingSelectionUpdate.current = null;
      }

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = undefined;
      }
    };
  }, [editor, handleMouseDown, handleMouseUp, hideMenu]);

  // Register command listeners
  useEffect(() => {
    return editor.registerCommand(SELECTION_CHANGE_COMMAND, onLexicalSelectionChange, COMMAND_PRIORITY_LOW);
  }, [editor, onLexicalSelectionChange]);

  // Don't render anything if there's no selection and no color picker
  if ((!isOpen || !selectionRect) && !showColorPicker) return null;

  return (
    <>
      {/* Formatting Menu */}
      {isOpen && selectionRect && !showColorPicker && (
        <div
          className={styles.FormattingMenu}
          style={{
            left: `${selectionRect.left + window.scrollX}px`,
            top: `${selectionRect.top + window.scrollY - 10}px`,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className={styles.FormattingMenuInner}>
            {FORMAT_OPTIONS.map(({ format, icon, label, hotkey }) => (
              <button
                key={format}
                data-selection-menu-button
                type="button"
                onClick={(e) => onFormatClick(format, e)}
                className={cn(
                  styles.FormatButton,
                  styles.ShowTooltip,
                  styles.TopAlign,
                  selectedFormats.has(format) && styles.active,
                )}
                data-tooltip={hotkey ? `${label} · ${hotkey}` : label}
              >
                {icon}
              </button>
            ))}

            {/* Color Picker Button */}
            <button
              data-selection-menu-button
              type="button"
              onClick={onColorPickerClick}
              className={cn(styles.FormatButton, styles.ShowTooltip, styles.TopAlign)}
              data-tooltip="Text & Highlight Colors"
            >
              <Palette size={14} style={{ color: "var(--gray-11)" }} />
            </button>
          </div>
        </div>
      )}

      {/* Color Picker Dropdown */}
      {showColorPicker && <ColorPicker position={colorPickerPosition} onClose={onColorPickerClose} />}
    </>
  );
}
