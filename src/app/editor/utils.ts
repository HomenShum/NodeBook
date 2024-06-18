import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isTextNode,
  LexicalEditor,
  LexicalNode,
  LineBreakNode,
  ParagraphNode,
  TextNode,
} from "lexical";

import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { $createMentionNode, $isMentionNode, MentionNode } from "@/app/graph/MentionNode";

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
    const positions = [
      { index: selectionStartIndex, offset: points[0].offset },
      { index: selectionEndIndex, offset: points[1].offset },
    ].sort((a, b) => (a.index === b.index ? a.offset - b.offset : a.index - b.index));
    // Need to do typecast here because sort breaks the type inference
    return positions as [LexicalEditorPosition, LexicalEditorPosition];
  });
}

/**
 * The content of graph nodes is a flat list of text and mention nodes.
 * This functions returns a flat list of lexical nodes which corresponds
 * to that content.
 */
function $getNodes(): LexicalNode[] {
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
}

/**
 * Returns the text content of the active editor (optionally between two positions).
 */
export function $getText({ from, to }: { from?: LexicalEditorPosition; to?: LexicalEditorPosition }): string {
  const nodes: LexicalNode[] = $getNodes();
  if (!nodes.length) return "";
  const fromDefined = from || { index: 0, offset: 0 };
  const toDefined = to || { index: nodes.length - 1, offset: nodes[nodes.length - 1].getTextContent().length };
  const nodesText = nodes.map((node, i) => {
    if (i < fromDefined.index || i > toDefined.index) {
      return "";
    } else if (i === fromDefined.index && i === toDefined.index) {
      return node.getTextContent().slice(fromDefined.offset, toDefined.offset);
    } else if (i === fromDefined.index) {
      return node.getTextContent().slice(fromDefined.offset);
    } else if (i === toDefined.index) {
      return node.getTextContent().slice(0, toDefined.offset);
    } else {
      return node.getTextContent();
    }
  });
  if (nodesText[nodesText.length - 1] === "\n") {
    // Sometimes the editor can get into a slightly odd state where the last node is a text node with just "\n"
    // in it. This is related to our handling of mention nodes.
    // In this case, we just remove the trailing newline because it breaks other logic.
    nodesText.pop();
  }
  return nodesText.join("");
}

/**
 * Returns the content of the active editor as a list of chips (optionally between two positions).
 */
export function $getChips(from?: LexicalEditorPosition, to?: LexicalEditorPosition): Chip[] {
  const nodes = $getNodes();
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

export const graphNodeMatchesParagraph = (node: GraphNode, paragraph: ParagraphNode, graphStore: GraphStore) => {
  const paragraphChildren = paragraph.getChildren();
  if (node.content.length !== paragraphChildren.length) return false;

  const match = node.content.every((chip, idx) => {
    if (chip.type !== paragraphChildren[idx].getType()) return false;

    if (chip.type === "mention") {
      const referencedNode = graphStore.getNode(chip.value);
      return referencedNode !== undefined && referencedNode.text === paragraphChildren[idx].getTextContent();
    } else {
      return chip.value === paragraphChildren[idx].getTextContent();
    }
  });

  return match;
};

export const createParagraphMatchingGraphNode = (node: GraphNode, graphStore: GraphStore): ParagraphNode => {
  const paragraph = $createParagraphNode();
  node.content.forEach((chip) => {
    if (chip.type == "mention") {
      const mentionNodeText = graphStore.getNode(chip.value)?.text || "";
      paragraph.append($createMentionNode(chip.value, mentionNodeText));
    } else {
      paragraph.append($createTextNode(chip.value));
    }
  });
  return paragraph;
};

export function nodeToChip(node: LexicalNode): Chip {
  if (node instanceof MentionNode) {
    return { type: "mention", value: node.mentionedGraphNodeId };
  } else if (node instanceof TextNode) {
    return { type: "text", value: node.getTextContent() };
  } else if (node instanceof LineBreakNode) {
    return { type: "linebreak", value: node.getTextContent() };
  } else {
    throw new Error("Unsupported node type");
  }
}
/**
 * Returns the content between two positions in the editor as a list of chips.
 */
