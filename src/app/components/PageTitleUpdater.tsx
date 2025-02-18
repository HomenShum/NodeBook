import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { GraphNode } from "@/app/graph/GraphNode";
import { Tree } from "@/app/tree/Tree";

interface Props {
  tree: Tree;
}

export const PageTitleUpdater = observer(function PageTitleUpdater({ tree }: Props) {
  useEffect(() => {
    const updateTitle = () => {
      const rootNode = tree.state.root;
      if (rootNode.object instanceof GraphNode) {
        const content = rootNode.object.content;
        const title = content.length > 0 ? content[0].value : "Untitled";
        document.title = `${title.slice(0, 20)}${title.length > 20 ? "..." : ""} - Zephyr`;
      }
    };

    // Update title initially
    updateTitle();

    // Set up reaction to content changes
    const disposer = reaction(
      () => {
        const rootNode = tree.state.root;
        return rootNode.object instanceof GraphNode ? rootNode.object.content.slice() : [];
      },
      () => {
        updateTitle();
      },
    );

    return () => {
      disposer();
    };
  }, [tree]);

  return null;
});
