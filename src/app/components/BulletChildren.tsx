import { observer } from "mobx-react-lite";
import { Bullet } from "../model/OutlineBullet";
import { useViewStore } from "../store/outline";
import { compareFractionIndices } from "../util";
import { BulletView } from "./BulletView/BulletView";

export const BulletChildren = observer(
  ({ bullet, parents, depth }: { bullet: Bullet; parents: Bullet[]; depth: number }) => {
    const viewStore = useViewStore();
    const viewType = viewStore.outlineViewStore.relatedNodesViewType;

    const children = bullet.children.sort((a, b) => compareFractionIndices(a.position, b.position));

    const pinned = bullet.pinnedChildren.sort((a, b) => compareFractionIndices(a.position, b.position));

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
            {bullet.isPinnedExpanded && <BulletList bullets={pinned} parents={parents} depth={depth} />}
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

const BulletList = ({ bullets, parents, depth }: { bullets: Bullet[]; parents: Bullet[]; depth: number }) => {
  return (
    <div>
      {bullets.map((bullet, i) => {
        return (
          <BulletView
            key={bullet.id}
            bullet={bullet}
            depth={depth}
            parents={parents}
            siblingAbove={bullets[i - 1]}
            siblingBelow={bullets[i + 1]}
          />
        );
      })}
    </div>
  );
};
