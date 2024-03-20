import { observer } from "mobx-react-lite";
import { Bullet } from "../model/OutlineBullet";
import { compareFractionIndices } from "../util";
import { BulletView } from "./BulletView/BulletView";

export const BulletChildren = observer(
  ({ bullet, parents, depth }: { bullet: Bullet; parents: Bullet[]; depth: number }) => {
    const children = bullet.children.sort((a, b) => compareFractionIndices(a.position, b.position));
    return (
      <div style={{ paddingLeft: `${depth * 2}rem` }}>
        {children.map((bullet, i) => {
          return (
            <BulletView
              key={bullet.id}
              bullet={bullet}
              depth={depth + 1}
              parents={[...parents, bullet]}
              siblingAbove={children[i - 1]}
              siblingBelow={children[i + 1]}
            />
          );
        })}
      </div>
    );
  },
);
