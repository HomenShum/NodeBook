import { relationsToNodes, relationsToPathStr } from "@/app/util";
import { observer } from "mobx-react-lite";
import { GraphRelation } from "../../model/GraphRelation";
import { useViewStore } from "../../store/useViewStore";
import { comparePositions } from "../../util";
import { RelatedNodeView, filterFocusedNodesRelations } from "./RelatedNodeView";

export const RelatedNodeChildren = observer(({ pathToParentRelations }: { pathToParentRelations: GraphRelation[] }) => {
  const viewStore = useViewStore();
  const depth = pathToParentRelations.length;

  const nodes = relationsToNodes(pathToParentRelations);

  const grandparent = nodes[nodes.length - 2];
  const parent = nodes[nodes.length - 1];
  const children = parent.relationsWithPositions
    .sort((a, b) => comparePositions(a.position, b.position))
    .filter(({ relation }) => {
      const childNode = relation.from.id === parent.id ? relation.to : relation.from;
      return filterFocusedNodesRelations(viewStore, relation, childNode, grandparent);
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
          <RelatedNodeView
            key={relationsToPathStr([...pathToParentRelations, childRelation])}
            pathToParentRelations={pathToParentRelations}
            relation={childRelation}
            siblingAbove={children[i - 1]?.relation}
            siblingBelow={children[i + 1]?.relation}
          />
        );
      })}
    </div>
  );
});

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
