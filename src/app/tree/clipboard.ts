import { $createRangeSelection, $getRoot, $isParagraphNode, $setSelection } from "lexical";

import { $getChips } from "@/app/editor/utils/content";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";

export type ChipsWithContext = {
  chips: Chip[];
  depth: number;
  isChecked?: boolean | null;
  nodeId?: string | undefined;
};

export const MEW_CLIPBOARD_MIMETYPE = "application/x-mew-graphstore";

const TEXT_TAB = "\t";

/**
 * Copy content from one or more DescendantTreeNodes.
 *
 * Note: we can't use Lexical's built-in copying logic because it assumes there's only a single editor instance being copied from.
 */
export const copyContentFromLexicalNodes = (addToEvent: ClipboardEvent, nodes: DescendantTreeNode[]): boolean => {
  const clipboardData = addToEvent.clipboardData;
  if (clipboardData === null) return false;

  const plainTextParts: string[] = [];
  const chipParts: ChipsWithContext[] = [];

  const minDepth = Math.min(...nodes.map(({ depth }) => depth));

  nodes.forEach(({ depth, lexicalEditor, object }) => {
    if (!lexicalEditor) return;
    lexicalEditor.update(() => {
      const fullSelection = $createRangeSelection();
      const firstChild = $getRoot().getFirstChild();
      const lastChild = $getRoot().getLastChild();
      if (!firstChild || !lastChild) return;

      // Handle paragraph nodes by getting their first/last text content
      const firstTextNode = $isParagraphNode(firstChild) ? firstChild.getFirstChild() : firstChild;
      const lastTextNode = $isParagraphNode(lastChild) ? lastChild.getLastChild() : lastChild;

      if (!firstTextNode || !lastTextNode) return;

      fullSelection.anchor.set(firstTextNode.getKey(), 0, "text");
      fullSelection.focus.set(lastTextNode.getKey(), lastTextNode.getTextContentSize(), "text");
      $setSelection(fullSelection);
      $setSelection(fullSelection);

      const nTabs = depth - minDepth;
      const prefix =
        object instanceof GraphNode && object.isChecked !== null ? (object.isChecked ? "[x] " : "[ ] ") : "";
      plainTextParts.push(TEXT_TAB.repeat(nTabs) + prefix + fullSelection.getTextContent());
      chipParts.push({
        chips: $getChips(),
        depth: nTabs,
        isChecked: object instanceof GraphNode ? object.isChecked : null,
        nodeId: object instanceof GraphNode ? object.id : undefined,
      });

      $setSelection(null);
    });
  });

  clipboardData.setData("text/plain", plainTextParts.join("\n"));
  clipboardData.setData(MEW_CLIPBOARD_MIMETYPE, JSON.stringify(chipParts));
  console.log(chipParts);

  return true;
};
