import { GraphObject } from "@/app/model/GraphObject";
import { relationsPathToParentChild, relationsToPathStr } from "@/app/util";
import { observer } from "mobx-react-lite";
import { GraphRelation } from "../../model/GraphRelation";
import { useViewStore } from "../../store/useViewStore";
import { comparePositions } from "../../util";
import { RelatedObjectView, filterFocusedNodesRelations } from "./RelatedObjectView";

export const RelatedObjectChildren = observer(
  ({
    pathToParentRelations,
    searchResult,
  }: {
    pathToParentRelations: GraphRelation[];
    searchResult?: Map<string, boolean>;
  }) => {
    const viewStore = useViewStore();
    const depth = pathToParentRelations.length;

    const pathToParent = relationsPathToParentChild(pathToParentRelations);
    const lastLinkToParent = pathToParent[pathToParent.length - 1];
    const grandparent = lastLinkToParent.parent;
    const parent = lastLinkToParent.child;
    const children = parent.relationsWithPositions
      .sort((a, b) => comparePositions(a.position, b.position))
      .filter(({ relation }) => {
        let childNode: GraphObject;
        if (relation.from.id === parent.id) {
          childNode = relation.to;
        } else if (relation.to.id === parent.id) {
          childNode = relation.from;
        } else {
          throw new Error("Relation does not connect to parent");
        }
        return (
          filterFocusedNodesRelations(viewStore, relation, childNode, grandparent) &&
          (!searchResult || searchResult.get(childNode.id))
        );
      });
    // const bundles = children.map(({ bullet }) => bullet).filter((b) => b.type === "bundle");

    return (
      <div className={depth > 0 ? "ml-5" : ""}>
        {/* {bundles.length > 0 ? (
          <BulletListWithBundles bullets={children} parents={parents} depth={depth} />
        ) : (
          <BulletList bullets={children} parents={parents} depth={depth} />
        )} */}
        {children.map(({ relation: childRelation }, i) => {
          return (
            <RelatedObjectView
              key={relationsToPathStr([...pathToParentRelations, childRelation])}
              path={[...pathToParentRelations, childRelation]}
              siblingAbove={children[i - 1]?.relation}
              siblingBelow={children[i + 1]?.relation}
              searchResult={searchResult}
            />
          );
        })}
      </div>
    );
  },
);

// export const BulletList = ({
//   bullets,
//   parents = [],
//   depth,
// }: {
//   bullets: { position: Position; bullet: Bullet }[];
//   parents?: Bullet[];
//   depth: number;
// }) => {
//   return (
//     <div>
//       {bullets.map(({ bullet, position }, i) => {
//         return (
//           <BulletView
//             key={bullet.id}
//             position={position}
//             bullet={bullet}
//             depth={depth}
//             parents={parents}
//             siblingAbove={bullets[i - 1]?.bullet}
//             siblingBelow={bullets[i + 1]?.bullet}
//           />
//         );
//       })}
//     </div>
//   );
// };

// export const BulletListWithBundles = ({
//   bullets,
//   parents = [],
//   depth,
// }: {
//   bullets: { position: Position; bullet: Bullet }[];
//   parents?: Bullet[];
//   depth: number;
// }) => {
//   const bundles = bullets.map(({ bullet }) => bullet).filter((b) => b.type === "bundle");

//   const insideBundle: Bullet[] = [];
//   const isInsideBundle = (b: Bullet) => insideBundle.map((b) => b.id).includes(b.id);
//   const setBundleStart = (b: Bullet) => insideBundle.push(b); // TODO handle duplicates
//   const setBundleEnd = (b: Bullet) => insideBundle.splice(insideBundle.indexOf(b), 1);

//   return (
//     <div>
//       {bullets.map(({ bullet, position }, i) => {
//         if (bullet.type === "bundle") return null;
//         const bundleIdsWithBullet = bundles
//           .filter((bundle) => bundle.graphNode.children.map((c) => c.id).includes(bullet.graphNode.id))
//           .map((b) => b.id);
//         return (
//           <div key={bullet.id}>
//             {bundles.map((bundle) => {
//               if (bundleIdsWithBullet.includes(bundle.id) && !isInsideBundle(bundle)) {
//                 setBundleStart(bundle);
//                 return (
//                   <div key={bundle.id} onClick={() => bundle.setType("bullet")}>
//                     --- {"<" + bundleLabel(bundle) + ">"} ---
//                   </div>
//                 );
//               } else if (!bundleIdsWithBullet.includes(bundle.id) && isInsideBundle(bundle)) {
//                 setBundleEnd(bundle);
//                 return (
//                   <div key={bundle.id} onClick={() => bundle.setType("bullet")}>
//                     --- {"</" + bundleLabel(bundle) + ">"} ---
//                   </div>
//                 );
//               }
//             })}
//             <BulletView
//               bullet={bullet}
//               position={position}
//               depth={depth}
//               parents={parents}
//               siblingAbove={bullets[i - 1]?.bullet}
//               siblingBelow={bullets[i + 1]?.bullet}
//             />
//           </div>
//         );
//       })}
//       {bundles.map((bundle) => {
//         if (isInsideBundle(bundle)) {
//           setBundleEnd(bundle);
//           return (
//             <div
//               key={bundle.id}
//               onClick={action(() => {
//                 bundle.setType("bullet");
//                 bundle.setIsExpanded(true);
//               })}
//             >
//               --- {"</" + bundleLabel(bundle) + ">"} ---
//             </div>
//           );
//         }
//       })}
//     </div>
//   );
// };

// function bundleLabel(bullet: Bullet) {
//   return bullet.graphNode.text || "#" + bullet.id;
// }
