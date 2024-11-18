import isHotkey from "is-hotkey";

import { Tree } from "@/app/tree/Tree";

export const isMoveUpHotKey = isHotkey("ArrowUp");
export const isMoveDownHotkey = isHotkey("ArrowDown");
export const isMoveSelectionHeadUpHotkey = isHotkey("shift+ArrowUp");
export const isMoveSelectionHeadDownHotkey = isHotkey("shift+ArrowDown");
export const isMoveSelectedNodesUpHotkey = isHotkey("mod+shift+ArrowUp");
export const isMoveSelectedNodesDownHotkey = isHotkey("mod+shift+ArrowDown");
export const isDeleteSelectionHotkey = isHotkey(["delete", "backspace"]);
export const isIndentSelectionHotkey = isHotkey("tab");
export const isDedentSelectionHotkey = isHotkey("shift+tab");
export const isEscapeSelectionHotkey = isHotkey("esc");
export const isZoomInHotkey = isHotkey("mod+.");
export const isZoomOutHotkey = isHotkey("mod+,");
export const isCopyHotkey = isHotkey("mod+c");
export const isExpandAtSelectionHotKey = isHotkey("mod+ArrowDown");
export const isCollapseAtSelectionHotKey = isHotkey("mod+ArrowUp");

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
  { predicate: isMoveSelectionHeadUpHotkey, action: (tree: Tree) => tree.moveNodeSelectionHeadUp() },
  { predicate: isMoveSelectionHeadDownHotkey, action: (tree: Tree) => tree.moveNodeSelectionHeadDown() },
  { predicate: isMoveSelectedNodesUpHotkey, action: (tree: Tree) => tree.moveSelectedNodesUp() },
  { predicate: isMoveSelectedNodesDownHotkey, action: (tree: Tree) => tree.moveSelectedNodesDown() },
  { predicate: isDeleteSelectionHotkey, action: (tree: Tree) => tree.deleteSelection() },
  { predicate: isIndentSelectionHotkey, action: (tree: Tree) => tree.indentSelection() },
  { predicate: isDedentSelectionHotkey, action: (tree: Tree) => tree.dedentSelection() },
  { predicate: isEscapeSelectionHotkey, action: (tree: Tree) => tree.escapeSelection() },
  { predicate: isZoomInHotkey, action: (tree: Tree) => tree.setCurrentNodeAsRoot() },
  { predicate: isZoomOutHotkey, action: (tree: Tree) => tree.setParentOfRootAsRoot() },
  { predicate: isExpandAtSelectionHotKey, action: (tree: Tree) => tree.expandAtSelection() },
  { predicate: isCollapseAtSelectionHotKey, action: (tree: Tree) => tree.collapseAtSelection() },
];

export const handleTreeHotkeys = (event: KeyboardEvent, tree: Tree): boolean => {
  for (const { predicate, action } of treeHotkeyMapping) {
    if (predicate(event, tree)) {
      event.preventDefault();
      event.stopPropagation();
      action(tree);
      return true;
    }
  }
  return false;
};
