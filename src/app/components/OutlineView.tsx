import { observer } from "mobx-react-lite";
import { useOutlineViewStore } from "../store/outline";
import { BulletView } from "./BulletView/BulletView";

export const OutlineView = observer(() => {
  const outlineViewStore = useOutlineViewStore();
  const root = outlineViewStore.currentViewRoot;
  const parents = root.parents;
  const children = root.children;

  return (
    <div style={{ width: "100%" }}>
      {parents.map((parent) => (
        <span
          key={parent.id}
          style={{ cursor: "pointer" }}
          onClick={() => {
            outlineViewStore.setCurrentViewRoot(parent);
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
