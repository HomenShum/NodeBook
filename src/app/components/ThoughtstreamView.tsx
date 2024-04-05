import { observer } from "mobx-react-lite";
import { useViewStore } from "../store/useViewStore";
import { BulletChildren } from "./BulletChildren";

export const ThoughtstreamView = observer(() => {
  const viewStore = useViewStore();
  const root = viewStore.outlineViewStore.thoughtstream;
  return (
    <div
      style={{ width: "100%" }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          console.log("create node");
          const note = root.createChild({});
          viewStore.setFocusedNode(note);
        }
      }}
    >
      <div className="ml-12">
        <h1 className="text-2xl font-bold select-none">{root.graphNode.text}</h1>
      </div>
      <BulletChildren bullet={root} depth={0} parents={[]} />
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
  );
});
