import { Plus } from "lucide-react";
import { useCallback } from "react";

import styles from "@/app/components/RelatedObject/styles/ChildGroups.module.css";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { PinnedGroup, TreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";

interface AddPinButtonProps {
  parentNode: TreeNode;
  group: PinnedGroup;
}

export function AddPinButton({ parentNode, group }: AddPinButtonProps) {
  const tree = useTree();
  const graphStore = useGraphStore();

  const handlePin = useCallback(
    async (e: React.MouseEvent) => {
      // Prevent click event from propogating so that the focus logic in here isn't overridden
      e.preventDefault();
      e.stopPropagation();

      // Create a new node with type "pin"
      const { node: newNode, relation } = await graphStore.addChildNode({
        parentId: parentNode.object.id,
        nodeProps: { content: [{ type: "text", value: "" }] },
      });
      tree.setGroupExpanded(group.path, true);

      // Pin the new relation
      parentNode.object.pinChildRelation(relation);

      // Focus the new node
      const pathToNewNode = group.createChildPath(relation);
      tree.setFocusedNode(pathToNewNode, "end", true);
    },
    [graphStore, group, parentNode.object, tree],
  );

  return (
    <Button className={styles.AddPinButton} variant="ghostSmooth" size="xs" onClick={handlePin}>
      <Plus size={14} strokeWidth={1.5} />
      <span>Add pin</span>
    </Button>
  );
}
