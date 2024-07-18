import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, BaseSelection, COMMAND_PRIORITY_NORMAL, KEY_ENTER_COMMAND, LexicalNode } from "lexical";
import { action } from "mobx";
import { useEffect } from "react";

import { useTreeNode } from "@/app/components/RelatedObject/RelatedObjectContext";
import { nodeToChip } from "@/app/editor/utils";
import { Chip, GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { useTree } from "@/app/tree/TreeContext";

function getChipsAroundSelection(selection: BaseSelection) {
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

    const paragraphNode = firstNode.getParent();
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

/**
 * Plugin to split nodes when enter is pressed. Also handles exiting temporary edit mode.
 */
export const EnterKeyPlugin = () => {
  const graphStore = useGraphStore();
  const renderController = useRenderController();
  const [editor] = useLexicalComposerContext();
  const { treeNode, viewType, setViewType } = useTreeNode();
  const tree = useTree();
  const object = treeNode.object;
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;
  const pathToNodeStr = treeNode.path;
  const pathToParentNodes = treeNode.parent.path;
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      action((event) => {
        if (!event || !graphStore) return false;
        if (event.shiftKey) return false;
        const selection = $getSelection();
        if (!selection || !selection.getNodes() || !selection.getStartEndPoints()) return false;
        if (!(object instanceof GraphNode)) {
          // For now, we don't support splitting relations. In ENT-3653, we'll
          // decide if and how to support this.
          console.log("Splitting relations is not supported yet.");
          return false;
        }
        event.preventDefault();
        event.stopPropagation();
        const { chipsBefore, chipsAfter } = getChipsAroundSelection(selection);
        tree.splitNode(treeNode, chipsBefore, chipsAfter);
        return true;
      }),
      COMMAND_PRIORITY_NORMAL,
    );
  }, [
    editor,
    graphStore,
    tree,
    object,
    parent,
    pathToNodeStr,
    pathToParentNodes,
    relation,
    setViewType,
    renderController,
    viewType,
    treeNode,
  ]);

  return null;
};
