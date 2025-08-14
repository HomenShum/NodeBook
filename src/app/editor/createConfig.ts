import { InitialConfigType } from "@lexical/react/LexicalComposer";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";

import { ImageNode } from "@/app/graph/ImageNode";
import { LinkNode } from "@/app/graph/LinkNode";
import { MentionNode } from "@/app/graph/MentionNode";
import { TreeNode } from "@/app/tree/nodes";
import logger from "@/lib/logger";

import { theme } from "./theme";

export const createConfig = ({
  namespace,
  treeNode,
  editable = true,
}: {
  namespace: string;
  treeNode: TreeNode;
  editable?: boolean;
}): InitialConfigType => {
  return {
    namespace,
    theme,
    onError: (e: Error) => logger.error('Editor error', { error: e }),
    nodes: [LinkNode, MentionNode, ImageNode],
    editorState: () => {
      const paragraph = $createParagraphNode();
      const text = $createTextNode(treeNode.object.text);
      paragraph.append(text);
      $getRoot().append(paragraph);
    },
    editable,
  };
};
