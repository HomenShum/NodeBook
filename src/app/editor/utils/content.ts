import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isParagraphNode,
  $isTextNode,
  LexicalNode,
  LineBreakNode,
  ParagraphNode,
  TextNode,
} from "lexical";

import { LexicalEditorPosition } from "@/app/editor/utils/selection";
import { defaultRelationTypes, DELETED_NODE_TEXT } from "@/app/graph/constants";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { GraphStore } from "@/app/graph/GraphStore";
import { $createLinkNode, $isLinkNode, LinkNode } from "@/app/graph/LinkNode";
import { $createMentionNode, $isMentionNode, MentionNode } from "@/app/graph/MentionNode";
import { GraphRelationType } from "@/app/graph/types";

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
      chips.push({
        type: "text",
        value: node.getTextContent().slice(from.offset, toDefined.offset),
        styles: node instanceof TextNode ? node.getFormat() : undefined,
      });
    } else if (i === from.index) {
      // handle start
      if ($isMentionNode(node)) {
        const text = node.getTextContent();
        if (from.offset === 0) {
          chips.push(nodeToChip(node));
        } else if (from.offset < text.length) {
          chips.push({ type: "text", value: text.slice(from.offset), styles: node.getFormat() });
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
          chips.push({ type: "text", value: text.slice(from.offset), styles: node.getFormat() });
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
          chips.push({ type: "text", value: text.slice(0, toDefined.offset), styles: node.getFormat() });
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
        console.log("styles", node.getFormat());
        if (toDefined.offset > 0) {
          chips.push({ type: "text", value: text.slice(0, toDefined.offset), styles: node.getFormat() });
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
    } else if (lexicalNode instanceof TextNode && chip.type === "text") {
      return chip.value === lexicalNode.getTextContent() && (!chip.styles || chip.styles === lexicalNode.getFormat());
    } else {
      return chip.value === lexicalNode.getTextContent();
    }
  });

  return match;
};

export const getChipToNodeFn = (graphStore: GraphStore) => {
  return (chip: Chip): LexicalNode => {
    if (chip.type === "mention") {
      const mentionNodeText = graphStore.getNode(chip.value)?.text ?? `[${DELETED_NODE_TEXT}]`;
      return $createMentionNode(chip.value, mentionNodeText);
    } else if (chip.type === "link") {
      return $createLinkNode(chip.url, chip.value);
    } else if (chip.type === "text") {
      const node = $createTextNode(chip.value);
      if (chip.styles) {
        node.setFormat(chip.styles);
      }
      return node;
    } else {
      return $createTextNode(chip.value);
    }
  };
};

export const $createParagraphMatchingGraphNode = (node: GraphNode, graphStore: GraphStore): ParagraphNode => {
  const paragraph = $createParagraphNode();
  const chipToNode = getChipToNodeFn(graphStore);
  paragraph.append(...node.content.map(chipToNode));
  return paragraph;
};

export function nodeToChip(node: LexicalNode): Chip {
  // For future reference, all classes extending TextNode should be processed before TextNode
  if (node instanceof MentionNode) {
    return { type: "mention", value: node.mentionedGraphNodeId };
  } else if (node instanceof LinkNode) {
    return { type: "link", value: node.getTextContent(), url: node.getURL() };
  } else if (node instanceof TextNode) {
    return { type: "text", value: node.getTextContent(), styles: node.getFormat() };
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
