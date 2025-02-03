import type { DOMConversionOutput, NodeKey, Spread } from "lexical";
import {
  $applyNodeReplacement,
  TextNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type LexicalNode,
  type SerializedTextNode,
} from "lexical";

import styles from "@/app/editor/Editor.module.css";

type SerializedLinkNode = Spread<
  {
    url: string;
    text: string;
  },
  SerializedTextNode
>;

function convertLinkElement(domNode: HTMLElement): DOMConversionOutput | null {
  const url = domNode.getAttribute("href");
  const text = domNode.textContent;
  if (url !== null && text !== null) {
    const node = $createLinkNode(url, text);
    return { node };
  }
  return null;
}

export class LinkNode extends TextNode {
  url: string;

  static getType(): string {
    return "link";
  }

  static clone(node: LinkNode): LinkNode {
    return new LinkNode(node.url, node.__text, node.__key);
  }

  static importJSON(serializedNode: SerializedLinkNode): LinkNode {
    const node = $createLinkNode(serializedNode.url, serializedNode.text);
    node.setTextContent(serializedNode.text);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  constructor(url: string, text: string, __key?: NodeKey) {
    // The __key parameter is required when cloning a node
    super(text, __key);
    this.url = url;
  }

  exportJSON(): SerializedLinkNode {
    return {
      ...super.exportJSON(),
      url: this.url,
      text: this.__text,
      type: "link",
      version: 1,
    };
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("a");
    dom.setAttribute("data-lexical-link", "true");
    dom.textContent = this.__text;
    dom.className = styles.LinkNode;
    dom.href = this.url;
    dom.rel = "noreferrer";
    dom.target = "_blank";

    dom.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(this.url, "_blank");
    });

    return dom;
  }

  exportDOM(): DOMExportOutput {
    return { element: this.createDOM() };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-link")) {
          return null;
        }
        return {
          conversion: convertLinkElement,
          priority: 1,
        };
      },
    };
  }

  getURL(): string {
    return this.url;
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

export function $createLinkNode(url: string, text: string): LinkNode {
  const linkNode = new LinkNode(url, text);
  return $applyNodeReplacement(linkNode);
}

export function $isLinkNode(node: LexicalNode | null | undefined): node is LinkNode {
  return node instanceof LinkNode;
}
