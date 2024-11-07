import {
  $createRangeSelection,
  $getEditor,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  BaseSelection,
  LexicalEditor,
  LexicalNode,
  RangeSelection,
} from "lexical";

import { nodeToChip } from "@/app/editor/utils/content";
import { Chip } from "@/app/graph/GraphNode";
import { TreeNodeContentSelection, TreeNodeContentSelectionPosition } from "@/app/tree/selection";

export type LexicalEditorPosition = { index: number; offset: number };

/**
 * Returns the selection as a pair of positions in the editor.
 * The first position is the selection anchor and the second is the focus.
 */
export function getLexicalSelectionPosition(editor: LexicalEditor): [LexicalEditorPosition, LexicalEditorPosition] {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!selection) {
      throw new Error("No selection found");
    }
    const points = selection.getStartEndPoints();
    if (!points) {
      throw new Error("Selection points not found");
    }
    const nodes: LexicalNode[] = selection.getNodes()[0].getParent()?.getChildren() || [];
    const selectionStartIndex = nodes.findIndex((n) => n.getKey() === points[0].key);
    const selectionEndIndex = nodes.findIndex((n) => n.getKey() === points[1].key);
    if (selectionStartIndex === -1 || selectionEndIndex === -1) {
      throw new Error("Selection points don't match any nodes");
    }
    const positions = [
      { index: selectionStartIndex, offset: points[0].offset },
      { index: selectionEndIndex, offset: points[1].offset },
    ].sort((a, b) => (a.index === b.index ? a.offset - b.offset : a.index - b.index));
    // Need to do typecast here because sort breaks the type inference
    return positions as [LexicalEditorPosition, LexicalEditorPosition];
  });
}

export const $setSelectionFromTree = (selection: TreeNodeContentSelection) => {
  if (selection.position === "start") {
    $getRoot().selectStart();
  } else if (selection.position === "end" || !selection.position) {
    $getRoot().selectEnd();
  } else {
    $setSelection($createLexicalSelectionFromTreePosition(selection.position));
  }
};

export function $createLexicalSelectionFromTreePosition(
  position: TreeNodeContentSelectionPosition,
): RangeSelection | null {
  if (position === "start") {
    const selection = $createRangeSelection();
    const firstChild = $getRoot().getFirstChild();
    if (!firstChild) return null;
    selection.anchor.set(firstChild.getKey(), 0, "text");
    selection.focus.set(firstChild.getKey(), 0, "text");
    return selection;
  } else if (position === "end") {
    const selection = $createRangeSelection();
    const lastChild = $getRoot().getLastChild();
    if (!lastChild) return null;
    selection.anchor.set(lastChild.getKey(), lastChild.getTextContentSize(), "text");
    selection.focus.set(lastChild.getKey(), lastChild.getTextContentSize(), "text");
    return selection;
  } else {
    return $createLexicalSelectionFromOffsets(position);
  }
}

function $createLexicalSelectionFromOffsets(
  position: { anchorOffset: number; focusOffset: number },
  selection: RangeSelection = $createRangeSelection(),
  currentNode: LexicalNode = $getRoot(),
  currentOffset: number = 0,
): RangeSelection | null {
  if ($isElementNode(currentNode)) {
    for (const child of currentNode.getChildren()) {
      // When the selection is initialized, the points are set to an element
      // node. When we set them, we set them to text nodes, so we can tell
      // if a point has been set by us by checking if the type is text.
      if (selection.anchor.type === "text" && selection.focus.type === "text") {
        return selection;
      }
      $createLexicalSelectionFromOffsets(position, selection, child, currentOffset);
      currentOffset += child.getTextContentSize();
    }
  } else {
    const length = currentNode.getTextContentSize();
    if (selection.anchor.type !== "text" && currentOffset + length >= position.anchorOffset) {
      selection.anchor.set(currentNode.getKey(), position.anchorOffset - currentOffset, "text");
    }
    if (selection.focus.type !== "text" && currentOffset + length >= position.focusOffset) {
      selection.focus.set(currentNode.getKey(), position.focusOffset - currentOffset, "text");
    }
    currentOffset += length;
  }
  if (selection.anchor.type !== "text" || selection.focus.type !== "text") {
    return null;
  }
  return selection;
}

/**
 * Returns the selection position of the editor as integer offsets from the start of the editor.
 *
 * This is different from {@link getLexicalSelectionPosition} which provides the offsets relative
 * to the lexical node the selection anchor/focus is in.
 */
export function $getSelectionPosition(): TreeNodeContentSelectionPosition | undefined {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return;
  }

  const { anchor, focus } = selection;
  let anchorOffset: number | null = null;
  let focusOffset: number | null = null;

  function findOffsets(node: LexicalNode, offset: number) {
    if (node === anchor.getNode()) {
      anchorOffset = offset + anchor.offset;
    }
    if (node === focus.getNode()) {
      focusOffset = offset + focus.offset;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        if (anchorOffset !== null && focusOffset !== null) {
          return;
        }
        findOffsets(child, offset);
        offset += child.getTextContentSize();
      }
    }
  }

  findOffsets($getRoot(), 0);

  if (anchorOffset === null || focusOffset === null) {
    return;
  }
  const lastOffset = $getRoot().getTextContentSize();
  if (anchorOffset === lastOffset && focusOffset === lastOffset) {
    return "end";
  }
  return { anchorOffset, focusOffset };
}

export function sameSelectionPositions(
  a: TreeNodeContentSelectionPosition | undefined,
  b: TreeNodeContentSelectionPosition | undefined,
) {
  if (!a || !b) return false;

  const aIsStart = a === "start" || (typeof a === "object" && a.anchorOffset === 0 && a.focusOffset === 0);
  const aIsEnd = a === "end";
  const bIsStart = b === "start" || (typeof b === "object" && b.anchorOffset === 0 && b.focusOffset === 0);
  const bIsEnd = b === "end";

  if (aIsStart && bIsStart) return true;
  if (aIsEnd && bIsEnd) return true;

  if (typeof a === "object" && typeof b === "object") {
    return a.anchorOffset === b.anchorOffset && a.focusOffset === b.focusOffset;
  }

  return false;
}

export function $getChipsAroundSelection(selection: BaseSelection) {
  // Get selection start and end points
  let start = { index: 0, offset: 0 };
  let end = { index: 0, offset: 0 };
  let nodes: LexicalNode[] = [];
  const nonEmptyEditor = selection.getNodes()[0]?.getParents()[0]?.getTextContent() !== "";
  if (nonEmptyEditor) {
    const points = selection?.getStartEndPoints();
    if (!points) {
      throw new Error("No selection points");
    }

    const selectionNodes = selection.getNodes();
    const firstNode = selectionNodes[0];
    const lastNode = selectionNodes[selectionNodes.length - 1];

    const paragraphNode = firstNode.getParentOrThrow();
    nodes = paragraphNode.getChildren();

    const firstNodeIndexInParagraph = nodes.findIndex((node) => node === firstNode);
    const lastNodeIndexInParagraph = nodes.findIndex((node) => node === lastNode);

    const selectionEnds = [
      { index: firstNodeIndexInParagraph, offset: points[0].offset },
      { index: lastNodeIndexInParagraph, offset: points[1].offset },
    ];
    start = selection.isBackward() ? selectionEnds[1] : selectionEnds[0];
    end = selection.isBackward() ? selectionEnds[0] : selectionEnds[1];
  }

  let chipsBefore: Chip[] = [];
  // Collect nodes before the selection
  chipsBefore.push(...nodes.slice(0, start.index).map(nodeToChip));
  // and the first part of the node the selection start
  if (nodes[start.index]) {
    if (start.offset < nodes[start.index].getTextContent().length) {
      chipsBefore.push({ type: "text", value: nodes[start.index].getTextContent().substring(0, start.offset) });
    } else {
      chipsBefore.push(nodeToChip(nodes[start.index]));
    }
  }

  let chipsAfter: Chip[] = [];
  // Collect the last part of the node after the selection end
  if (nodes[end.index] && end.offset < nodes[end.index].getTextContent().length) {
    chipsAfter.push({ type: "text", value: nodes[end.index].getTextContent().substring(end.offset) });
  }
  // and all the nodes after that
  chipsAfter.push(...nodes.slice(end.index + 1).map(nodeToChip));

  // remove any empty text chips
  chipsBefore = chipsBefore.filter((chip) => chip.type !== "text" || chip.value !== "");
  chipsAfter = chipsAfter.filter((chip) => chip.type !== "text" || chip.value !== "");

  return { chipsBefore, chipsAfter };
}

/**
 * Returns the text before the selection, the text inside selection
 * and the text after selection. Very apt description. :)
 */
export function $getTextAroundSelection() {
  let beforeText = "";
  let selectedText = "";
  let afterText = "";

  const selection = $getSelection();

  if (!$isRangeSelection(selection)) {
    return {
      beforeText,
      selectedText,
      afterText,
    };
  }

  const start = selection.isBackward() ? selection.focus : selection.anchor;
  const startNode = start.getNode();

  //Find the text before the selection.
  for (const node of $getRoot().getAllTextNodes()) {
    if (node === startNode) {
      beforeText = beforeText + startNode.__text.slice(0, start.offset);
      break;
    }
    beforeText = beforeText + node.__text;
  }

  selectedText = selection.getTextContent();
  afterText = $getRoot()
    .getTextContent()
    .slice(beforeText.length + selectedText.length);
  return { beforeText, selectedText, afterText };
}

/**
 * Returns the vertical position of a caret inside an editor.
 */
export function $getCaretPosition(): null | {
  lineCount: number;
  lineNumber: number;
  isAtTop: boolean;
  isAtBottom: boolean;
} {
  const selection = $getSelection();
  const nativeSelection = window.getSelection();
  const editorElement = $getEditor().getRootElement();
  if (!$isRangeSelection(selection) || !nativeSelection || !editorElement) return null;
  const range = nativeSelection.getRangeAt(0);
  let lineNumber = 1;
  let lineCount = 1;
  const caretRects = range.getClientRects();
  if (caretRects.length > 0) {
    const caretRect = caretRects[caretRects.length - 1];
    const inputBoxRect = editorElement.getBoundingClientRect();
    const lineHeight = parseInt(getComputedStyle(editorElement).lineHeight, 10);
    lineCount = inputBoxRect.height / lineHeight;
    while (caretRect.top > inputBoxRect.top + lineHeight * lineNumber) {
      lineNumber++;
    }
  }

  return {
    lineCount,
    lineNumber,
    isAtTop: lineNumber === 1,
    isAtBottom: lineCount === lineNumber,
  };
}
