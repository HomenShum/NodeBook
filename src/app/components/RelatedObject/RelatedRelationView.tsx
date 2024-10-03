import { observer } from "mobx-react-lite";

import { TreeNodeInputSuffix } from "@/app/components/RelatedObject/TreeNodeInputSuffix";
import { DescendantTreeNode } from "@/app/tree/nodes";

interface Props {
  treeNode: DescendantTreeNode;
}

export const RelatedRelationView = observer(function RelatedRelationView({ treeNode }: Props) {
  return (
    <div style={{ display: "flex" }}>
      <span style={{ fontStyle: "italic" }}>{treeNode.object.text}</span>
      <TreeNodeInputSuffix treeNode={treeNode} isEditorEditable={false} />
    </div>
  );
});
