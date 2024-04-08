import { observer } from "mobx-react-lite";
import { useGraphStore } from "../store/useGraphStore";
import { useViewStore } from "../store/useViewStore";
import { BulletChildren } from "./BulletChildren";

export const ThoughtstreamView = observer(() => {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();
  const root = graphStore.thoughtstreamBulletRoot;
  root.setIsExpanded(true);
  return (
    <div
      className="w-full px-8"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          console.log("create node");
          const { bullet } = root.createChild();
          viewStore.setFocusedNode(bullet);
        }
      }}
    >
      <div className="ml-2">
        <div className="flex align-center gap-2">
          <h1 className="text-2xl font-bold select-none">{root.graphNode.text}</h1>
          <button
            className="select-none"
            onClick={() => {
              const { bullet } = root.createChild();
              viewStore.setFocusedNode(bullet);
            }}
          >
            +
          </button>
        </div>
      </div>
      <BulletChildren bullet={root} depth={0} parents={[]} />
    </div>
  );
});
