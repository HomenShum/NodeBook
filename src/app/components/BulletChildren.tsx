import { action, reaction } from "mobx";
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

    const children = bullet.childrenWithPositions
      .sort((a, b) => comparePositions(a.position, b.position))
      .filter(({ bullet: childBullet }) =>
        filterFocusedNodesRelations(
          viewStore,
          childBullet.graphRelation,
          childBullet.graphNode,
          bullet.parent?.graphNode,
        ),
      );
    const bundles = children.map(({ bullet }) => bullet).filter((b) => b.type === "bundle");

    return (
      <div className={depth > 0 ? "ml-8" : ""}>
        {bundles.length > 0 ? (
          <BulletListWithBundles bullets={children} parents={parents} depth={depth} />
        ) : (
          <BulletList bullets={children} parents={parents} depth={depth} />
        )}
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

export const BulletListWithBundles = ({
  bullets,
  parents = [],
  depth,
}: {
  bullets: { position: Position; bullet: Bullet }[];
  parents?: Bullet[];
  depth: number;
}) => {
  const bundles = bullets.map(({ bullet }) => bullet).filter((b) => b.type === "bundle");

  const insideBundle: Bullet[] = [];
  const isInsideBundle = (b: Bullet) => insideBundle.map((b) => b.id).includes(b.id);
  const setBundleStart = (b: Bullet) => insideBundle.push(b); // TODO handle duplicates
  const setBundleEnd = (b: Bullet) => insideBundle.splice(insideBundle.indexOf(b), 1);

  return (
    <div>
      {bullets.map(({ bullet }, i) => {
        const bundleIdsWithBullet = bundles
          .filter((bundle) => bundle.graphNode.children.map((c) => c.id).includes(bullet.graphNode.id))
          .map((b) => b.id);
        return (
          <div key={bullet.id}>
            {bundles.map((bundle) => {
              if (bundleIdsWithBullet.includes(bundle.id) && !isInsideBundle(bundle)) {
                setBundleStart(bundle);
                return (
                  <div key={bundle.id} onClick={() => bundle.setType("bullet")}>
                    --- {"<" + bundleLabel(bundle) + ">"} ---
                  </div>
                );
              } else if (!bundleIdsWithBullet.includes(bundle.id) && isInsideBundle(bundle)) {
                setBundleEnd(bundle);
                return (
                  <div key={bundle.id} onClick={() => bundle.setType("bullet")}>
                    --- {"</" + bundleLabel(bundle) + ">"} ---
                  </div>
                );
              }
            })}
            {bullet.type === "bullet" && (
              <BulletView
                bullet={bullet}
                depth={depth}
                parents={parents}
                siblingAbove={bullets[i - 1]?.bullet}
                siblingBelow={bullets[i + 1]?.bullet}
              />
            )}
          </div>
        );
      })}
      {bundles.map((bundle) => {
        if (isInsideBundle(bundle)) {
          setBundleEnd(bundle);
          return (
            <div
              key={bundle.id}
              onClick={action(() => {
                bundle.setType("bullet");
                bundle.setIsExpanded(true);
              })}
            >
              --- {"</" + bundleLabel(bundle) + ">"} ---
            </div>
          );
        }
      })}
    </div>
  );
};

function bundleLabel(bullet: Bullet) {
  return bullet.graphNode.text || "#" + bullet.id;
}
