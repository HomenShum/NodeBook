import { useEffect } from "react";

import { renderGraph } from "@/app/components/GraphView/graphRender";
import { Tree } from "@/app/tree/Tree";

export default function GraphContainer({ tree }: { tree: Tree }) {
  useEffect(() => {
    let cleanupFn: (() => void) | undefined;

    renderGraph("graph-container", tree, (node) => {
      // TODO: editing and other cool stuffs
    }).then((cleanup) => {
      cleanupFn = cleanup;
    });

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [tree]);
  return <div id="graph-container" style={{ width: "100%", height: "100%" }}></div>;
}
