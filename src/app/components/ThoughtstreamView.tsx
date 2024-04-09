import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useCallback } from "react";
import { useGraphStore } from "../store/useGraphStore";
import { useViewStore } from "../store/useViewStore";
import { BulletChildren } from "./BulletChildren";

export const ThoughtstreamView = observer(() => {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const root = graphStore.thoughtstreamBulletRoot;
  root.setIsExpanded(true);

  const createBullet = useCallback(() => {
    const { bullet } = root.createChild();
    const { bullet: bundle } = root.createChild();
    graphStore.createRelation({ from: bundle.graphNode, to: bullet.graphNode });
    bundle.setType("bundle");
    viewStore.setFocusedNode(bullet);
  }, [root, graphStore, viewStore]);

  return (
    <div
      className="w-full px-8"
      onKeyDown={action((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          createBullet();
        }
      })}
    >
      <div className="ml-2">
        <div className="flex align-center gap-2">
          <h1 className="text-2xl font-bold select-none">{root.graphNode.text}</h1>
          <button className="select-none" onClick={createBullet}>
            +
          </button>
        </div>
      </div>
      <BulletChildren bullet={root} depth={0} parents={[]} />
    </div>
  );
});
