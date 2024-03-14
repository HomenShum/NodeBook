import { observer } from "mobx-react-lite";
import { Bullet, sortBullets } from "../model/OutlineBullet";
import { useViewStore } from "../store/outline";
import { BulletView } from "./BulletView/BulletView";

export const OutlineView = observer(() => {
  const viewStore = useViewStore();
  const root = viewStore.currentViewRoot as Bullet;
  if (!root) {
    return <div>Loading...</div>;
  }
  const ancestors = root.ancestors;
  const children = root.children.sort(sortBullets);

  return (
    <div style={{ width: "100%" }}>
      {ancestors.map((parent) => (
        <span
          key={parent.id}
          style={{ cursor: "pointer" }}
          onClick={() => {
            viewStore.setRoot(parent.graphNode);
          }}
        >
          {parent.graphNode.text} /{" "}
        </span>
      ))}
      <h1>{root.graphNode.text}</h1>
      {children.map((child, i) => (
        <BulletView
          key={child.id}
          bullet={child}
          depth={1}
          parents={[...ancestors, root]}
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
