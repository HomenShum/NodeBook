import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isTextNode,
  BaseSelection,
  LexicalEditor,
  LexicalNode,
  LineBreakNode,
  ParagraphNode,
  TextNode,
} from "lexical";

import { defaultRelationTypes, DELETED_NODE_TEXT } from "@/app/graph/constants";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { $createLinkNode, $isLinkNode, LinkNode } from "@/app/graph/LinkNode";
import { $createMentionNode, $isMentionNode, MentionNode } from "@/app/graph/MentionNode";
import { GraphRelationType } from "@/app/graph/types";

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
  if (!nodes.length) return [];
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
      } else if ($isLinkNode(node)) {
        const text = node.getTextContent();
        if (from.offset === 0) {
          chips.push(nodeToChip(node));
        } else if (from.offset < text.length) {
          chips.push({ type: "link", url: node.getURL(), value: text.slice(from.offset) });
        } else {
          // skip the link node
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
      } else if ($isLinkNode(node)) {
        const text = node.getTextContent();
        if (toDefined.offset >= text.length) {
          chips.push(nodeToChip(node));
        } else if (toDefined.offset > 0) {
          chips.push({ type: "link", url: node.getURL(), value: text.slice(0, toDefined.offset) });
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

const nodeEmpty = (node: GraphNode): boolean => {
  return node.content.length === 0 || node.content.every((chip) => chip.type === "text" && chip.value === "");
};

const paragraphEmpty = (paragraph: ParagraphNode): boolean => {
  return paragraph.getChildren().length === 0 || paragraph.getChildren().every((node) => node.getTextContent() === "");
};

export const graphNodeMatchesParagraph = (node: GraphNode, paragraph: ParagraphNode, graphStore: GraphStore) => {
  const paragraphChildren = paragraph.getChildren();
  if (nodeEmpty(node) && paragraphEmpty(paragraph)) return true;
  if (node.content.length !== paragraphChildren.length) return false;

  const match = node.content.every((chip, idx) => {
    const lexicalNode = paragraphChildren[idx];
    if (chip.type !== lexicalNode.getType()) return false;
    if (chip.type === "mention") {
      if (!$isMentionNode(lexicalNode)) return false;
      const referencedNode = graphStore.getNode(chip.value);
      if (!referencedNode && lexicalNode.mentionedGraphNodeText === `[${DELETED_NODE_TEXT}]`) return true;
      return referencedNode !== undefined && referencedNode.text === lexicalNode.mentionedGraphNodeText;
    } else if (chip.type === "link") {
      if (!$isLinkNode(lexicalNode)) return false;
      return chip.url === lexicalNode.getURL() && chip.value === lexicalNode.getTextContent();
    } else {
      return chip.value === lexicalNode.getTextContent();
    }
  });

  return match;
};

export const createParagraphMatchingGraphNode = (node: GraphNode, graphStore: GraphStore): ParagraphNode => {
  const paragraph = $createParagraphNode();
  node.content.forEach((chip) => {
    if (chip.type == "mention") {
      const mentionNodeText = graphStore.getNode(chip.value)?.text ?? `[${DELETED_NODE_TEXT}]`;
      paragraph.append($createMentionNode(chip.value, mentionNodeText));
    } else if (chip.type == "link") {
      paragraph.append($createLinkNode(chip.url, chip.value));
    } else {
      paragraph.append($createTextNode(chip.value));
    }
  });
  return paragraph;
};

export function nodeToChip(node: LexicalNode): Chip {
  // For future reference, all classes extending TextNode should be processed before TextNode
  if (node instanceof MentionNode) {
    return { type: "mention", value: node.mentionedGraphNodeId };
  } else if (node instanceof LinkNode) {
    return { type: "link", value: node.getTextContent(), url: node.getURL() };
  } else if (node instanceof TextNode) {
    return { type: "text", value: node.getTextContent() };
  } else if (node instanceof LineBreakNode) {
    return { type: "linebreak", value: node.getTextContent() };
  } else {
    throw new Error("Unsupported node type");
  }
}

export function matchDefaultRelationType(text: string): GraphRelationType | undefined {
  for (const type of Object.values(defaultRelationTypes)) {
    if (type.label === text) {
      return type;
    }
  }
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
