import { $getRoot, $getSelection, $isParagraphNode, $isTextNode, LexicalEditor, LexicalNode } from "lexical";
import { Chip } from "../model/GraphNode";
import { $isMentionNode } from "../model/MentionNode";

export function nodeToChip(node: LexicalNode): Chip {
  if ($isMentionNode(node)) {
    return { type: "mention", value: node.mentionedGraphNodeId };
  } else if ($isTextNode(node)) {
    return { type: "text", value: node.getTextContent() };
  } else {
    throw new Error("Unsupported node type");
  }
}

type LexicalEditorPosition = { index: number; offset: number };

/**
 * Returns the selection as a pair of positions in the editor.
 * The first position is the selection anchor and the second is the focus.
 */
export function getSelectionPositions(editor: LexicalEditor): [LexicalEditorPosition, LexicalEditorPosition] {
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
    return [
      { index: selectionStartIndex, offset: points[0].offset },
      { index: selectionEndIndex, offset: points[1].offset },
    ];
  });
}

/**
 * The content of graph nodes is a flat list of text and mention nodes.
 * This functions returns a flat list of lexical nodes which corresponds
 * to that content.
 */
function getNodes(editor: LexicalEditor): LexicalNode[] {
  return editor.getEditorState().read(() => {
    const children = $getRoot().getChildren();
    if (children.length === 0) {
      return [];
    }
    if (children.length > 1) {
      throw new Error("Expected only one child node");
    }
    const child = children[0];
    if (!$isParagraphNode(child)) {
      throw new Error("Expected a paragraph node");
    }
    return child.getChildren();
  });
}

/**
 * Returns the text content between two positions in the editor.
 */
export function getTextBetween(
  editor: LexicalEditor,
  from?: LexicalEditorPosition,
  to?: LexicalEditorPosition,
): string {
  const nodes: LexicalNode[] = getNodes(editor);
  if (!from) {
    return nodes.map((node) => node.getTextContent()).join("");
  }
  const toDefined = to || { index: nodes.length - 1, offset: nodes[nodes.length - 1].getTextContent().length };
  return nodes
    .map((node, i) => {
      if (i < from.index || i > toDefined!.index) {
        return "";
      } else if (i === from.index && i === toDefined.index) {
        return node.getTextContent().slice(from.offset, toDefined.offset);
      } else if (i === from.index) {
        return node.getTextContent().slice(from.offset);
      } else if (i === toDefined.index) {
        return node.getTextContent().slice(0, toDefined.offset);
      } else {
        return node.getTextContent();
      }
    })
    .join("");
}

/**
 * Returns the content between two positions in the editor as a list of chips.
 */
export function getChipsBetween(
  editor: LexicalEditor,
  from?: LexicalEditorPosition,
  to?: LexicalEditorPosition,
): Chip[] {
  const nodes = getNodes(editor);
  if (!from) {
    return nodes.map(nodeToChip);
  }
  const toDefined = to || { index: nodes.length - 1, offset: nodes[nodes.length - 1].getTextContent().length };
  const chips: Chip[] = [];
  nodes.forEach((node, i) => {
    if (i < from.index || i > toDefined.index) {
      // skip nodes outside of the range
      return;
    }
    if (i === from.index && i === toDefined.index) {
      chips.push({ type: "text", value: node.getTextContent().slice(from.offset, toDefined.offset) });
    } else if (i === from.index) {
      // handle start
      if ($isMentionNode(node)) {
        const text = node.getTextContent();
        if (from.offset === 0) {
          chips.push(nodeToChip(node));
        } else if (from.offset < text.length) {
          chips.push({ type: "text", value: text.slice(from.offset) });
        } else {
          // skip the mention node
        }
      } else if ($isTextNode(node)) {
        const text = node.getTextContent();
        if (from.offset < text.length) {
          chips.push({ type: "text", value: text.slice(from.offset) });
        } else {
          // skip the text node
        }
      } else {
        console.error("Unexpected node type", node);
      }
    } else if (i === toDefined.index) {
      // handle end
      if ($isMentionNode(node)) {
        const text = node.getTextContent();
        if (toDefined.offset >= text.length) {
          chips.push(nodeToChip(node));
        } else if (toDefined.offset > 0) {
          chips.push({ type: "text", value: text.slice(0, toDefined.offset) });
        } else {
          console.error("Unexpected offset", toDefined);
        }
      } else if ($isTextNode(node)) {
        const text = node.getTextContent();
        if (toDefined.offset > 0) {
          chips.push({ type: "text", value: text.slice(0, toDefined.offset) });
        } else {
          // skip the text node
        }
      } else {
        console.error("Unexpected node type", node);
      }
    } else {
      // handle middle
      chips.push(nodeToChip(node));
    }
  });
  return chips;
}
