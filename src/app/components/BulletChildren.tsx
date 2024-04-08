import { reaction } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { Bullet } from "../model/OutlineBullet";
import { useViewStore } from "../store/useViewStore";
import { Position, comparePositions } from "../util";
import { BulletView, filterFocusedNodesRelations } from "./BulletView/BulletView";

export const BulletChildren = observer(
  ({ bullet, parents, depth }: { bullet: Bullet; parents: Bullet[]; depth: number }) => {
    const viewStore = useViewStore();

    useEffect(
      () =>
        reaction(
          () => bullet.graphNode.allRelationsList.keys,
          () => bullet.updateChildren(),
        ),
      [bullet],
    );

    return (
      <div className={bullet.type === "bullet" && depth > 0 ? "ml-8" : ""}>
        <BulletList
          bullets={bullet.childrenWithPositions
            .sort((a, b) => comparePositions(a.position, b.position))
            .filter(({ bullet: childBullet }) =>
              filterFocusedNodesRelations(
                viewStore,
                childBullet.graphRelation,
                childBullet.graphNode,
                bullet.parent?.graphNode,
              ),
            )}
          parents={parents}
          depth={depth}
        />
      </div>
    );
  },
);

export const BulletList = ({
  bullets,
  parents = [],
  depth,
}: {
  bullets: { position: Position; bullet: Bullet }[];
  parents?: Bullet[];
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
