import { observer } from "mobx-react-lite";
import { useViewStore } from "../store/useViewStore";
import { BulletChildren } from "./BulletChildren";

export const ThoughtstreamView = observer(() => {
  const viewStore = useViewStore();

  const root = viewStore.outlineViewStore.thoughtstream;

  return (
    <div style={{ width: "100%" }}>
      <div className="ml-12">
        <h1 className="text-2xl font-bold select-none">{root.graphNode.text}</h1>
      </div>
      <BulletChildren bullet={root} depth={0} parents={[]} />
      <button
        className="select-none"
        onClick={() => {
          const bullet = root.createChild();
          viewStore.setFocusedNode(bullet);
        }}
      >
        +
      </button>
    </div>
  );
});
