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
      className="w-full px-8 flex flex-col gap-4"
      style={{ maxWidth: 1000 }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          const { bullet } = root.createChild();
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
          <h1 className="text-2xl font-medium select-none">{root.graphNode.text}</h1>
          <button
            className="select-none text-xl font-light bg-slate-50 hover:bg-slate-200 hover:shadow-inner transition-colors duration-150 ease-in w-6 h-6 text-center rounded-lg relative translate-y-1"
            onClick={() => {
              const { bullet } = root.createChild();
              viewStore.setFocusedNode(bullet);
            }}
          >
            <span className="absolute -translate-x-[6px] -translate-y-[15px]">+</span>
          </button>
        </div>
      </div>
      <BulletChildren bullet={root} depth={0} parents={[...ancestors, root]} />
    </div>
  );
});
