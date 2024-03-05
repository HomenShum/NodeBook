import { observer } from "mobx-react-lite";
import { useOutlineViewStore } from "../store/outline";
import { BulletView } from "./BulletView/BulletView";

export const OutlineView = observer(() => {
  const treeViewStore = useOutlineViewStore();
  const root = treeViewStore.currentViewRoot;
  const parents = root.parents;
  const children = root.children;

  return (
    <div>
      {parents.map((parent) => (
        <span
          key={parent.id}
          style={{ cursor: "pointer" }}
          onClick={() => {
            treeViewStore.setCurrentViewRoot(parent);
          }}
        >
          {parent.graphNode.text} /{" "}
        </span>
      ))}
      <h1>{root.graphNode.text}</h1>
      {root.children.map((child, i) => (
        <BulletView
          key={child.id}
          bullet={child}
          depth={1}
          parents={[...parents, root]}
          siblingAbove={children[i - 1]}
          siblingBelow={children[i + 1]}
        />
      ))}
      <button
        onClick={() => {
          const { child } = root.graphNode.createChild();
          setTimeout(() => {
            const el = document.querySelector(`[data-nodeid="${child.id}"]`);
            if (el instanceof HTMLElement) el.focus();
          }, 0);
        }}
      >
        +
      </button>
    </div>
  );
});
