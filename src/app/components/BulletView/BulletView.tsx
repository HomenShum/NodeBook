import { Editor } from "../../editor/Editor";
import styles from "./BulletView.module.css";
import { observer } from "mobx-react-lite";
import { Bullet } from "../../model/OutlineBullet";
import { useOutlineViewStore } from "../../store/outline";
import { useGraphStore } from "../../store/graph";

export const Toggle = observer(({ bullet }: { bullet: Bullet }) => {
  const outlineViewStore = useOutlineViewStore();
  return (
    <button
      style={{
        backgroundColor: "transparent",
        border: "none",
        width: "1rem",
        fontSize: "0.75rem",
        color:
          outlineViewStore.hoveredNode?.id === bullet.id
            ? "black"
            : "transparent",
        cursor: "pointer",
      }}
      onClick={() => bullet.toggleExpanded()}
    >
      {bullet.isExpanded ? "▼" : "▶"}
    </button>
  );
});

export const BulletView = observer(
  ({
    bullet,
    depth = 0,
    parents = [],
    siblingAbove,
    siblingBelow,
  }: {
    bullet: Bullet;
    depth?: number;
    parents?: Bullet[];
    siblingAbove?: Bullet;
    siblingBelow?: Bullet;
  }) => {
    const graphStore = useGraphStore();
    const outlineViewStore = useOutlineViewStore();
    const children = bullet.children;

    const isForward =
      bullet.graphRelation?.from.id === bullet.parent?.graphNode.id;

    return (
      <>
        <div
          className={styles.Bullet}
          onMouseEnter={() => outlineViewStore.setHoveredNode(bullet)}
          onMouseLeave={() => outlineViewStore.setHoveredNode(null)}
        >
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} className={styles.indent}>
              &nbsp;
            </span>
          ))}
          {/* dropdown to change relation type */}
          {/* <div>{bullet.graphRelation?.type.label}↳</div> */}
          <div style={{ display: "flex", gap: "5px" }}>
            <select
              style={{ width: "75px" }}
              value={bullet.graphRelation?.type.label}
              onChange={(e) => {
                // TODO
                const selectedRelationType =
                  graphStore.relationTypes[
                    e.target.value as keyof typeof graphStore.relationTypes
                  ];
                if (!selectedRelationType || !bullet.graphRelation) return; // TODO
                graphStore.updateRelationType(
                  bullet.graphRelation,
                  selectedRelationType
                );
              }}
            >
              {Object.values(graphStore.relationTypes).map(
                ({ id, label, reverseLabel }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                )
              )}
            </select>
            {isForward ? (
              <span>↳</span>
            ) : (
              <span style={{ transform: "rotate(90deg)" }}>↲</span>
            )}
          </div>
          <Toggle bullet={bullet} />
          <span
            className={styles.bulletChar}
            onClick={() => {
              console.log("clicked bullet");
              outlineViewStore.setCurrentViewRoot(bullet);
            }}
          >
            {"\u2022"}
          </span>
          {/* relation type */}
          <div
            style={{ gap: "5px", display: "flex", alignItems: "flex-start" }}
          >
            <div>
              <Editor
                node={bullet}
                onChange={(v) => bullet.graphNode.setText(v ?? "")}
                context={{ node: bullet, parents, siblingAbove, siblingBelow }}
              />
              <div
                style={{ display: "flex", fontSize: "0.75rem", gap: "10px" }}
              >
                <span style={{ color: "gray" }}>
                  bulletId: {bullet.id.slice(0, 8)}
                </span>
                <span style={{ color: "gray" }}>
                  nodeId: {bullet.graphNode.id.slice(0, 8)}
                </span>
              </div>
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
  }
);
