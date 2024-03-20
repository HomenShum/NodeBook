import { observer } from "mobx-react-lite";
import { useViewStore } from "../store/outline";
import { BulletChildren } from "./BulletChildren";

export const OutlineView = observer(() => {
  const viewStore = useViewStore();
  const root = viewStore.outlineViewStore.root;
  if (!root) {
    return <div>Missing root node</div>;
  }
  const ancestors = root.ancestors;

  return (
    <div style={{ width: "100%" }}>
      {ancestors.map((parent) => (
        <span
          key={parent.id}
          style={{ cursor: "pointer" }}
          onClick={() => {
            viewStore.outlineViewStore.setRoot(parent);
          }}
        >
          {parent.graphNode.text} /{" "}
        </span>
      ))}
      <h1>{root.graphNode.text}</h1>
      <BulletChildren bullet={root} depth={1} parents={[...ancestors, root]} />
      <button
        onClick={() => {
          const bullet = root.createRelatedBullet();
          viewStore.setFocusedNode(bullet);
        }}
      >
        +
      </button>
    </div>
  );
});
