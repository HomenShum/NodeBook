import { observer } from "mobx-react-lite";
import { useViewStore } from "../store/useViewStore";
import { BulletChildren } from "./BulletChildren";

export const OutlineView = observer(() => {
  const viewStore = useViewStore();
  const root = viewStore.currentOutlineViewRoot;
  if (!root) {
    return <div>Missing root node</div>;
  }
  const ancestors = root.ancestors;
  root.setIsExpanded(true);

  return (
    <div
      className="w-full px-8"
      style={{ maxWidth: 1000 }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          console.log("create node");
          const bullet = root.createChild();
          viewStore.setFocusedNode(bullet);
        }
      }}
    >
      <div className="ml-2">
        <div>
          {ancestors.map((parent) => (
            <span
              key={parent.id}
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => {
                viewStore.setCurrentOutlineViewRoot(parent);
              }}
            >
              {parent.graphNode.text} /{" "}
            </span>
          ))}
        </div>
        <div className="flex align-center gap-2">
          <h1 className="text-2xl font-bold select-none">{root.graphNode.text}</h1>
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
      </div>
      <BulletChildren bullet={root} depth={0} parents={[...ancestors, root]} />
    </div>
  );
});
