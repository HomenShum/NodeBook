import { $createRangeSelection, $getRoot, $setSelection } from "lexical";

import { $getChips } from "@/app/editor/utils/content";
import { Chip } from "@/app/graph/GraphNode";
import { DescendantTreeNode } from "@/app/tree/nodes";

export type ChipsWithContext = {
  chips: Chip[];
  depth: number;
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

  nodes.forEach(({ depth, lexicalEditor }) => {
    if (!lexicalEditor) return;
    lexicalEditor.update(() => {
      const fullSelection = $createRangeSelection();
      const firstChild = $getRoot().getFirstChild();
      const lastChild = $getRoot().getLastChild();
      if (!firstChild || !lastChild) return;

      fullSelection.anchor.set(firstChild.getKey(), 0, "text");
      fullSelection.focus.set(lastChild.getKey(), lastChild.getTextContentSize(), "text");
      $setSelection(fullSelection);

      const nTabs = depth - minDepth;
      plainTextParts.push(TEXT_TAB.repeat(nTabs) + fullSelection.getTextContent());
      chipParts.push({ chips: $getChips(), depth: nTabs });

      $setSelection(null);
    });
  });

  clipboardData.setData("text/plain", plainTextParts.join("\n"));
  clipboardData.setData(MEW_CLIPBOARD_MIMETYPE, JSON.stringify(chipParts));

  return true;
};
