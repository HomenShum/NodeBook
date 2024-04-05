import { observer } from "mobx-react-lite";
import { useViewStore } from "../store/useViewStore";
import { BulletList } from "./BulletChildren";
import { getFilteredChildren } from "./BulletView/BulletView";

export const ThoughtstreamView = observer(() => {
  const viewStore = useViewStore();
  const root = viewStore.outlineViewStore.thoughtstream;
  const children = getFilteredChildren(root, viewStore);
  return (
    <div
      className="w-full px-8"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          console.log("create node");
          const note = root.createChild({});
          viewStore.setFocusedNode(note);
        }
      }}
    >
      <div className="ml-2">
        <div className="flex align-center gap-2">
          <h1 className="text-2xl font-bold select-none">{root.graphNode.text}</h1>
          <button
            className="select-none"
            onClick={() => {
              const bullet = root.createChild({});
              viewStore.setFocusedNode(bullet);
            }}
          >
            +
          </button>
        </div>
      </div>
      {/* <BulletChildren bullet={root} depth={0} parents={[]} /> */}
      <BulletList bullets={children} depth={0} />
    </div>
  );
});
