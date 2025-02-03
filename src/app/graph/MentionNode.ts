import type { NodeKey, Spread } from "lexical";
import {
  $applyNodeReplacement,
  TextNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type SerializedTextNode,
} from "lexical";

import styles from "@/app/editor/Editor.module.css";
import { MENTION_SYMBOL, MentionTrigger } from "@/lib/utils";
// Much of this implementation is copied from:
// https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/nodes/MentionNode.ts

type SerializedMentionNode = Spread<
  {
    mentionedGraphNodeId: string;
    mentionedGraphNodeText: string;
    mentionTrigger: MentionTrigger;
  },
  SerializedTextNode
>;

function convertMentionElement(domNode: HTMLElement): DOMConversionOutput | null {
  const textContent = domNode.textContent;
  const mentionedGraphNodeId = domNode.getAttribute("data-lexical-mentioned-graph-node-id");
  if (textContent !== null && mentionedGraphNodeId !== null) {
    const node = $createMentionNode(
      mentionedGraphNodeId,
      textContent,
      domNode.getAttribute("data-lexical-mention-trigger") as MentionTrigger,
    );
    return { node };
  }
  return null;
}

export class MentionNode extends TextNode {
  mentionedGraphNodeId: string;
  mentionedGraphNodeText: string;
  mentionTrigger: MentionTrigger;

  static getType(): string {
    return "mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.mentionedGraphNodeId, node.mentionedGraphNodeText, node.mentionTrigger, node.__key);
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    const node = $createMentionNode(
      serializedNode.mentionedGraphNodeId,
      serializedNode.mentionedGraphNodeText,
      serializedNode.mentionTrigger,
    );
    node.setTextContent(serializedNode.text);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  constructor(
    mentionedGraphNodeId: string,
    mentionedGraphNodeText: string,
    mentionTrigger: MentionTrigger,
    __key?: NodeKey,
  ) {
    // The __key parameter is required when cloning a node
    super(mentionTrigger === MENTION_SYMBOL ? "@" + mentionedGraphNodeText : mentionedGraphNodeText, __key);
    this.mentionedGraphNodeId = mentionedGraphNodeId;
    this.mentionedGraphNodeText = mentionedGraphNodeText;
    this.mentionTrigger = mentionTrigger;
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      mentionedGraphNodeId: this.mentionedGraphNodeId,
      mentionedGraphNodeText: this.mentionedGraphNodeText,
      mentionTrigger: this.mentionTrigger,
      type: "mention",
      version: 1,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className = styles.MentionNode;
    dom.setAttribute("data-lexical-mention", "true");
    dom.setAttribute("data-lexical-mentioned-graph-node-id", this.mentionedGraphNodeId);
    dom.setAttribute("data-lexical-mention-trigger", this.mentionTrigger);
    return dom;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-mention", "true");
    element.setAttribute("data-lexical-mentioned-graph-node-id", this.mentionedGraphNodeId);
    element.setAttribute("data-lexical-mention-trigger", this.mentionTrigger);
    element.textContent = this.__text;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-mention")) {
          return null;
        }
        return {
          conversion: convertMentionElement,
          priority: 1,
        };
      },
    };
  }

  isTextEntity(): true {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  // This disable saving format when serialized to backend
  canHaveFormat(): boolean {
    return false;
  }

  // This disable formatting behaviour on the DOM node
  setFormat(format: number): this {
    return this;
  }
}

export function $createMentionNode(
  mentionedGraphNodeId: string,
  mentionedGraphNodeText: string,
  mentionTrigger: MentionTrigger,
): MentionNode {
  const mentionNode = new MentionNode(mentionedGraphNodeId, mentionedGraphNodeText, mentionTrigger);
  mentionNode.setMode("token").toggleDirectionless();
  return $applyNodeReplacement(mentionNode);
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode;
}
