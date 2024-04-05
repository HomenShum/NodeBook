import { observer } from "mobx-react-lite";
import { Bullet } from "../model/OutlineBullet";
import { useViewStore } from "../store/useViewStore";
import { Position, comparePositions } from "../util";
import { BulletView } from "./BulletView/BulletView";

export const BulletChildren = observer(
  ({ bullet, parents, depth }: { bullet: Bullet; parents: Bullet[]; depth: number }) => {
    const viewStore = useViewStore();
    const viewType = viewStore.outlineViewStore.relatedNodesViewType;

    let children = bullet.childrenWithPositions.sort((a, b) => comparePositions(a.position, b.position));
    const pinnedChildren = bullet.pinnedChildrenWithPositions.sort((a, b) => comparePositions(a.position, b.position));
    if (!viewStore.showDirectParent) {
      children = children.filter((x) => x.bullet.graphRelation?.id !== bullet.graphRelation?.id);
    }

    return (
      <div className={bullet.type === "bullet" && depth > 0 ? "ml-8" : ""}>
        {viewType === "all" ? (
          <BulletList bullets={children} parents={parents} depth={depth} />
        ) : (
          <div>
            <div className="flex align-center">
              <button onClick={() => bullet.togglePinnedExpanded()}>{bullet.isPinnedExpanded ? "▼" : "▶"}</button>
              <span>Pinned:</span>
            </div>
            {bullet.isPinnedExpanded && <BulletList bullets={pinnedChildren} parents={parents} depth={depth} />}
            <div className="flex align-center">
              <button onClick={() => bullet.toggleAllRelationsExpanded()}>
                {bullet.isAllRelationsExpanded ? "▼" : "▶"}
              </button>
              <span>All related:</span>
            </div>
            {bullet.isAllRelationsExpanded && <BulletList bullets={children} parents={parents} depth={depth} />}
          </div>
        )}
      </div>
    );
  },
);

export const BulletList = ({
  bullets,
  parents,
  depth,
}: {
  bullets: { position: Position; bullet: Bullet }[];
  parents: Bullet[];
  depth: number;
}) => {
  return (
    <div>
      {bullets.map(({ bullet, position }, i) => {
        return (
          <BulletView
            key={bullet.id}
            position={position}
            bullet={bullet}
            depth={depth}
            parents={parents}
            siblingAbove={bullets[i - 1]?.bullet}
            siblingBelow={bullets[i + 1]?.bullet}
          />
        );
      })}
    </div>
  );
};
