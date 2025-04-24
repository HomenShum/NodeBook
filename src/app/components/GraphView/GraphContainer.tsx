import { useEffect } from "react";

import { renderGraph } from "@/app/components/GraphView/graphRender";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { BaseTreeNode } from "@/app/tree/nodes";
import { Tree } from "@/app/tree/Tree";

export default function GraphContainer({ tree }: { tree: Tree }) {
  const settingsStore = useSettingsStore();

  useEffect(() => {
    let cleanupFn: (() => void) | undefined;

    renderGraph("graph-container", tree, settingsStore, (node: BaseTreeNode) => {
      // TODO: editing and other cool stuffs
    }).then((cleanup) => {
      cleanupFn = cleanup;
    });

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [tree, settingsStore]);
  return <div id="graph-container" style={{ width: "100%", height: "100%" }}></div>;
}
