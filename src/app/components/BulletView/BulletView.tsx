import { observer } from "mobx-react-lite";
import { Editor } from "../../editor/Editor";
import { Bullet } from "../../model/OutlineBullet";
import { useGraphStore } from "../../store/graph";
import { useViewStore } from "../../store/outline";
import { RelationCombobox } from "../RelationCombobox";
import styles from "./BulletView.module.css";

export const Toggle = observer(({ bullet }: { bullet: Bullet }) => {
  const viewStore = useViewStore();
  return (
    <button
      style={{
        backgroundColor: "transparent",
        border: "none",
        width: "1rem",
        fontSize: "0.75rem",
        color: viewStore.hoveredNode?.id === bullet.id ? "black" : "transparent",
        cursor: "pointer",
      }}
      onClick={() => bullet.toggleExpanded()}
    >
      {bullet.isExpanded ? "▼" : "▶"}
    </button>
  );
});

interface Props {
  bullet: Bullet;
  depth?: number;
  parents?: Bullet[];
  siblingAbove?: Bullet;
  siblingBelow?: Bullet;
}

export const BulletView = observer(({ bullet, depth = 0, parents = [], siblingAbove, siblingBelow }: Props) => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const children = bullet.children;

  return (
    <>
      <div
        className={styles.Bullet}
        onMouseEnter={() => viewStore.setHoveredNode(bullet)}
        onMouseLeave={() => viewStore.setHoveredNode(null)}
      >
        {Array.from({ length: depth }).map((_, i) => (
          <span key={i} className={styles.indent}>
            &nbsp;
          </span>
        ))}
        <div style={{ display: "flex", gap: "5px" }}>
          <RelationCombobox bullet={bullet} />
          <span>↳</span>
        </div>
        <Toggle bullet={bullet} />
        <span
          className={styles.bulletChar}
          onClick={() => {
            console.log("clicked bullet");
            viewStore.setRoot(bullet.graphNode);
          }}
        >
          {"\u2022"}
        </span>
        {/* relation type */}
        <div
          style={{
            gap: "5px",
            display: "flex",
            alignItems: "flex-start",
            flex: 1,
          }}
        >
          <div style={{ flex: 1 }}>
            <Editor
              node={bullet}
              onChange={(v) => bullet.graphNode.setText(v ?? "")}
              context={{ node: bullet, siblingAbove, siblingBelow }}
            />
            {viewStore.showNodeDetails && (
              <div style={{ display: "flex", fontSize: "0.75rem", gap: "10px" }}>
                <span style={{ color: "gray" }}>bulletId: {bullet.id.slice(0, 8)}</span>
                <span style={{ color: "gray" }}>nodeId: {bullet.graphNode.id.slice(0, 8)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {bullet.isExpanded &&
        children.map((node, i) => {
          return (
            <BulletView
              key={node.id}
              bullet={node}
              depth={depth + 1}
              parents={[...parents, node]}
              siblingAbove={children[i - 1]}
              siblingBelow={children[i + 1]}
            />
          );
        })}
    </>
  );
});
