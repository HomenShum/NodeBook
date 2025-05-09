import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";
import * as React from "react";

export interface ImagePayload {
  src: string;
}

function convertImageElement(domNode: Node): null | DOMConversionOutput {
  if (domNode instanceof HTMLImageElement) {
    const { src } = domNode;
    const node = $createImageNode({ src });
    return { node };
  }
  return null;
}

export type SerializedImageNode = Spread<
  {
    src: string;
    type: "image";
    version: number;
  },
  SerializedLexicalNode
>;

export class ImageNode extends DecoratorNode<JSX.Element> {
  src: string;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.src, node.__key);
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { src } = serializedNode;
    return $createImageNode({
      src,
    });
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("img");
    element.setAttribute("src", this.src);
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: (node: Node) => ({
        conversion: convertImageElement,
        priority: 0,
        // If you are reading this, congrats, you won the lottery.
        // Get back to work now.
      }),
    };
  }

  constructor(src: string, __key?: NodeKey) {
    super(__key);
    this.src = src;
  }

  exportJSON(): SerializedImageNode {
    return {
      type: "image",
      version: 1,
      src: this.getSrc(),
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    const theme = config.theme;
    const className = theme.image;
    if (className !== undefined) {
      span.className = className;
    }
    return span;
  }

  updateDOM(): false {
    return false;
  }

  getSrc(): string {
    return this.src;
  }

  decorate(): JSX.Element {
    return <img src={this.src} alt={"Image"} />;
  }

  isInline() {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return false;
  }
}

export function $createImageNode({ src }: ImagePayload): ImageNode {
  return new ImageNode(src);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
