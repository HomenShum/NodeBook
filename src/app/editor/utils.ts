import { $isTextNode, LexicalNode } from "lexical";
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
