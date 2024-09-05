import { InitialConfigType } from "@lexical/react/LexicalComposer";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";

import { MentionNode } from "@/app/graph/MentionNode";
import { TreeNode } from "@/app/tree/nodes";

export const createConfig = ({
  namespace,
  treeNode,
  editable = false,
}: {
  namespace: string;
  treeNode: TreeNode;
  editable?: boolean;
}): InitialConfigType => {
  return {
    namespace,
    theme: {},
    onError: (e: any) => console.error(e),
    nodes: [MentionNode],
    editorState: () => {
      const paragraph = $createParagraphNode();
      const text = $createTextNode(treeNode.object.text);
      paragraph.append(text);
      $getRoot().append(paragraph);
    },
    editable,
  };
};
