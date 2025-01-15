import isHotkey, { toKeyName } from "is-hotkey";

import { Tree } from "@/app/tree/Tree";

export const modKeyName = toKeyName("mod") === "control" ? "Ctrl" : "⌘";
export const optionKeyName = toKeyName("opt") === "alt" ? "Alt" : "⌥";

export const isMoveUpHotKey = isHotkey("ArrowUp");
export const isMoveDownHotkey = isHotkey("ArrowDown");
export const isMoveLeftHotkey = isHotkey("ArrowLeft");
export const isMoveRightHotKey = isHotkey("ArrowRight");
export const isMoveSelectionHeadUpHotkey = isHotkey("shift+ArrowUp");
export const isMoveSelectionHeadDownHotkey = isHotkey("shift+ArrowDown");
export const isMoveSelectedNodesUpHotkey = isHotkey("mod+shift+ArrowUp");
export const isMoveSelectedNodesDownHotkey = isHotkey("mod+shift+ArrowDown");
export const isDeleteSelectionHotkey = isHotkey(["delete", "backspace"]);
export const isIndentSelectionHotkey = isHotkey("tab");
export const isDedentSelectionHotkey = isHotkey("shift+tab");
export const isEscapeSelectionHotkey = isHotkey("esc");
export const isToggleTodoHotkey = isHotkey("[");
export const isZoomInHotkey = isHotkey("mod+.");
export const isZoomOutHotkey = isHotkey("mod+,");
export const isCopyHotkey = isHotkey("mod+c");
export const isExpandAtSelectionHotKey = isHotkey("mod+ArrowDown");
export const isCollapseAtSelectionHotKey = isHotkey("mod+ArrowUp");
export const isCommandBarHotKey = isHotkey("mod+shift+k");
export const isQuickCaptureHotkey = isHotkey("mod+opt+k");
export const isRightSidebarHotkey = isHotkey("mod+opt+s");
export const isFocusSearchHotkey = isHotkey("mod+/");

export const treeHotkeyMapping: {
  predicate: (event: KeyboardEvent, tree?: Tree) => boolean;
  action: (tree: Tree) => void | boolean;
}[] = [
  {
    predicate: (event, tree?: Tree) => tree?.selection?.type === "node" && isMoveUpHotKey(event),
    action: (tree: Tree) => tree.moveEditorSelectionUp(),
  },
  {
    predicate: (event, tree?: Tree) => tree?.selection?.type === "node" && isMoveDownHotkey(event),
    action: (tree: Tree) => tree.moveEditorSelectionDown(),
  },
  {
    predicate: (event, tree?: Tree) => tree?.selection?.type === "node" && isMoveLeftHotkey(event),
    action: (tree: Tree) => tree.setAnchorToEditorSelection("start"),
  },
  {
    predicate: (event, tree?: Tree) => tree?.selection?.type === "node" && isMoveRightHotKey(event),
    action: (tree: Tree) => tree.setAnchorToEditorSelection("end"),
  },
  { predicate: isMoveSelectionHeadUpHotkey, action: (tree: Tree) => tree.moveNodeSelectionHeadUp() },
  { predicate: isMoveSelectionHeadDownHotkey, action: (tree: Tree) => tree.moveNodeSelectionHeadDown() },
  { predicate: isMoveSelectedNodesUpHotkey, action: (tree: Tree) => tree.moveSelectedNodesUp() },
  { predicate: isMoveSelectedNodesDownHotkey, action: (tree: Tree) => tree.moveSelectedNodesDown() },
  {
    predicate: (event, tree) => isDeleteSelectionHotkey(event) && tree?.selection?.type === "node",
    action: (tree: Tree) => tree.deleteSelection(),
  },
  { predicate: isIndentSelectionHotkey, action: (tree: Tree) => tree.indentSelection() },
  { predicate: isDedentSelectionHotkey, action: (tree: Tree) => tree.dedentSelection() },
  { predicate: isEscapeSelectionHotkey, action: (tree: Tree) => tree.escapeSelection() },
  { predicate: isExpandAtSelectionHotKey, action: (tree: Tree) => tree.expandAtSelection() },
  { predicate: isCollapseAtSelectionHotKey, action: (tree: Tree) => tree.collapseAtSelection() },
  { predicate: isToggleTodoHotkey, action: (tree: Tree) => tree.toggleTodo() },
];

export const handleTreeHotkeys = (event: KeyboardEvent, tree: Tree): boolean => {
  for (const { predicate, action } of treeHotkeyMapping) {
    if (predicate(event, tree)) {
      if (predicate !== isToggleTodoHotkey) {
        event.preventDefault();
        event.stopPropagation();
      }
      action(tree);
      return true;
    }
  }
  return false;
};
