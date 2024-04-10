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
      tabIndex={0}
      className="w-full h-full flex flex-col px-8 gap-4"
      onKeyDown={action((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          createBullet();
        }
      })}
    >
      <div className="ml-2">
        <div className="flex gap-2">
          <h1 className="text-2xl font-medium select-none">{root.graphNode.text}</h1>
          <button
            className="select-none text-xl font-light bg-slate-50 hover:bg-slate-200 hover:shadow-inner transition-colors duration-150 ease-in w-6 h-6 text-center rounded-lg relative translate-y-1"
            onClick={createBullet}
          >
            <span className="absolute -translate-x-[6px] -translate-y-[15px]">+</span>
          </button>
        </div>
      </div>
      <div className="flex-1">
        <BulletChildren bullet={root} depth={0} parents={[]} />
      </div>
    </div>
  );
});
