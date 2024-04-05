import { observer } from "mobx-react-lite";
import { useViewStore } from "../store/useViewStore";
import { BulletChildren } from "./BulletChildren";

export const OutlineView = observer(() => {
  const viewStore = useViewStore();
  const root = viewStore.outlineViewStore.root;
  if (!root) {
    return <div>Missing root node</div>;
  }
  const ancestors = root.ancestors;

  return (
    <div
      style={{ width: "100%", maxWidth: 1000 }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          console.log("create node");
          const bullet = root.createChild();
          viewStore.setFocusedNode(bullet);
        }
      }}
    >
      <div className="ml-12">
        <div className="h-6">
          {ancestors.map((parent) => (
            <span
              key={parent.id}
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => {
                viewStore.outlineViewStore.setRoot(parent);
              }}
            >
              {parent.graphNode.text} /{" "}
            </span>
          ))}
        </div>
        <h1 className="text-2xl font-bold select-none">{root.graphNode.text}</h1>
      </div>
      <BulletChildren bullet={root} depth={0} parents={[...ancestors, root]} />
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
