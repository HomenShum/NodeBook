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
    //$createLexicalSelectionFromTreePosition returns null with input {anchorOffset: 0, focusOffset: 0} when the node
    //content empty. This case can only occur when empty nodes are being merged and selection.position is
    //set to offsets.
    //Just set the selection to end position (which is the default) if we don't have RangeSelection.
    const rangeSelection = $createLexicalSelectionFromTreePosition(selection.position);
    if (rangeSelection) {
      $setSelection(rangeSelection);
    } else {
      // If we can't create a proper selection with the given offsets,
      // check if the offsets are at a valid position and try a fallback
      const totalLength = $getRoot().getTextContentSize();
      const { anchorOffset, focusOffset } = selection.position;

      // If the offsets are exactly at the total length, it means cursor should be at end
      if (anchorOffset >= totalLength && focusOffset >= totalLength) {
        $getRoot().selectEnd();
      } else if (anchorOffset <= 0 && focusOffset <= 0) {
        $getRoot().selectStart();
      } else {
        // Try to create a clamped selection with valid offsets
        const clampedAnchor = Math.min(anchorOffset, totalLength);
        const clampedFocus = Math.min(focusOffset, totalLength);
        const clampedRangeSelection = $createLexicalSelectionFromTreePosition({
          anchorOffset: clampedAnchor,
          focusOffset: clampedFocus,
        });
        if (clampedRangeSelection) {
          $setSelection(clampedRangeSelection);
        } else {
          $getRoot().selectEnd();
        }
      }
    }
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
      const childResult = $createLexicalSelectionFromOffsets(position, selection, child, currentOffset);
      if (childResult && childResult.anchor.type === "text" && childResult.focus.type === "text") {
        return childResult;
      }
      currentOffset += child.getTextContentSize();
    }
  } else {
    const length = currentNode.getTextContentSize();
    // Set anchor if we haven't set it yet and this node contains the anchor position
    if (
      selection.anchor.type !== "text" &&
      currentOffset <= position.anchorOffset &&
      currentOffset + length >= position.anchorOffset
    ) {
      const relativeOffset = Math.max(0, Math.min(position.anchorOffset - currentOffset, length));
      selection.anchor.set(currentNode.getKey(), relativeOffset, "text");
    }
    // Set focus if we haven't set it yet and this node contains the focus position
    if (
      selection.focus.type !== "text" &&
      currentOffset <= position.focusOffset &&
      currentOffset + length >= position.focusOffset
    ) {
      const relativeOffset = Math.max(0, Math.min(position.focusOffset - currentOffset, length));
      selection.focus.set(currentNode.getKey(), relativeOffset, "text");
    }
  }

  // Return selection only if both anchor and focus are properly set
  if (selection.anchor.type !== "text" || selection.focus.type !== "text") {
    return null;
  }
  return selection;
}

/**
 * Returns the selection position of the editor as integer offsets from the start of the editor.
 *
 * Warning: This will return undefined when the selection is inside a DecoratorNode (i.e ImageNode)
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

  function findOffsets(node: LexicalNode, currentOffset: number) {
    // Check if this node contains our anchor or focus points
    if (node === anchor.getNode()) {
      anchorOffset = currentOffset + anchor.offset;
    }
    if (node === focus.getNode()) {
      focusOffset = currentOffset + focus.offset;
    }

    // If we've found both points, we're done
    if (anchorOffset !== null && focusOffset !== null) {
      return;
    }

    // For element nodes, recursively check children
    if ($isElementNode(node)) {
      let childOffset = currentOffset;
      for (const child of node.getChildren()) {
        // Early return if we've found both anchor and focus
        if (anchorOffset !== null && focusOffset !== null) {
          return;
        }
        findOffsets(child, childOffset);
        childOffset += child.getTextContentSize();
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
  if (caretRects.length > 0 && editorElement.children.length >= 0) {
    const caretRect = caretRects[caretRects.length - 1];

    // There could be multiple HTML children (<span>,<span><img></span>) of a different heights on a
    // single line OR there could be a single <span> element spanning multiple lines.
    // So every new Y coordinate meaning beginning of a new line.

    //Note: Our Editor element always has a single <p> tag and that <p> contains <span> tag(s).
    //<img> too is always wrapped in a <span> tag in our code.
    const uniqueYCoordinates = new Set<number>();
    Array.from(editorElement.children[0].children).forEach((element) => {
      Array.from(element.getClientRects()).forEach((rect) => {
        uniqueYCoordinates.add(rect.y);
      });
    });

    lineCount = uniqueYCoordinates.size;
    let lineIndex = 0;
    for (const y of Array.from(uniqueYCoordinates)) {
      if (y > caretRect.bottom) {
        break;
      }
      lineNumber = lineIndex + 1;
      lineIndex++;
    }
  }

  return {
    lineCount,
    lineNumber,
    isAtTop: lineNumber === 1,
    isAtBottom: lineCount === lineNumber,
  };
}

export function $atEditorStart() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const startEnd = selection.getStartEndPoints();
  if (!startEnd) return false;
  const [selectionStart, selectionEnd] = startEnd;

  // Editor content is structured as nodes.
  // At the start of every node, the offset is expected to be 0.
  // However, the offset is 0 only when the caret is positioned at the start of the first node.
  // In all other cases, it returns the end offset of the previous node.
  //
  // For example: If the cursor is placed between "_" (a space) and "@",
  // you are at the start of the Mention Node. However, the offset will be 7,
  // which is the end offset of the preceding Text Node ("Taylor_"), instead of 0.
  //  0 1 2 3 4 5 6 7 1 2 3 4 5 6 1 2 3 4
  //   T a y l o r _ @ l i k e s _ c a t
  //  |_____________|___________|_______|
  //     TNode          MNode     TNode

  // Since I added ImageNodes, this has changed a bit. Turns out the offsets are for a
  // continuous series of similar types of nodes (that's what am guessing based on my debugger).
  // So if we have a image node before the text/mention node (both of them, mention node and text
  // node are TextNode), we get offset 0 at the start of the combination of these
  // nodes but it's a local offset, not a global.

  //
  // 0 1            0 1 2 3 4 5 6 7 1 2 3 4 5 6 1 2 3 4
  //  H  Image Node  T a y l o r _ @ l i k e s _ c a t
  // |_|            |_____________|___________|_______|
  // TNode             TNode          MNode     TNode
  //
  const isChildIndexInsideParentZero =
    selection.getNodes().length > 0 && selection.getNodes()[0].getIndexWithinParent() === 0;

  return selectionStart.offset === 0 && selectionEnd.offset === 0 && isChildIndexInsideParentZero;
}
