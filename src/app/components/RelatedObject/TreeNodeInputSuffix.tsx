import { autorun } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { useGraphStore } from "@/app/graph/useGraphStore";
import { DescendantTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";

/**
 * For non-editable object renderings, we still want to allow the user to place focus at the end
 * of the object so they can add a sibling below it. Place this component at the end of the object
 * rendering to support this behaviour.
 */
export const TreeNodeInputSuffix = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  const tree = useTree();
  const graph = useGraphStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Update the input focus to match the tree selection
  useEffect(() => {
    return autorun(() => {
      if (tree.isNodeFocused(treeNode.id)) {
        inputRef.current?.focus();
      } else if (tree.selection?.type === "node" && inputRef.current?.contains(document.activeElement)) {
        inputRef.current?.blur();
      }
    });
  }, [tree, treeNode.id]);

  return (
    <input
      style={{ display: "flex", background: "none", border: "none", outline: "none" }}
      // Update the tree selection to match the input focus
      onFocus={() => tree.setFocusedNode(treeNode.path)}
      onBlur={() => tree.isNodeFocused(treeNode.id) && tree.setFocusedNode(null)}
      onKeyDown={async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const path = await treeNode.parent.createChild({ after: treeNode });
          tree.setFocusedNode(path);
        } else if (e.key === "Backspace") {
          e.preventDefault();
          const node = await graph.addNode({ nodeProps: { content: treeNode.object.text.slice(0, -1) } });
          await treeNode.setObject(node);
        }
      }}
      ref={inputRef}
      type="text"
      value=""
      onChange={() => {}}
    />
  );
});
