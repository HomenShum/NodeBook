import { observer } from "mobx-react-lite";

import { TreeNodeInputSuffix } from "@/app/components/RelatedObject/TreeNodeInputSuffix";
import { DescendantTreeNode } from "@/app/tree/nodes";

export const RelatedRelationView = observer(({ treeNode }: { treeNode: DescendantTreeNode }) => {
  return (
    <div style={{ display: "flex" }}>
      <span style={{ fontStyle: "italic" }}>{treeNode.object.text}</span>
      <TreeNodeInputSuffix treeNode={treeNode} />
    </div>
  );
});
