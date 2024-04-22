import { GraphNode } from "@/app/model/GraphNode";
import { GraphObject } from "@/app/model/GraphObject";
import { ViewStore } from "@/app/model/ViewStore";
import { PathLink, comparePositions, relationsPathToParentChild, relationsToPathStr } from "@/app/util";
import { observer } from "mobx-react-lite";
import { GraphRelation } from "../../model/GraphRelation";
import { useViewStore } from "../../store/useViewStore";
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
    const children = getFilteredChildrenAtPath(pathToParent, viewStore, searchResult);

    const parent = pathToParent[pathToParent.length - 1].child;

    const bundles = parent.children.filter((c) => c instanceof GraphNode && c.isBundle);
    const findRelationsFirstBundle = (r: GraphRelation) =>
      bundles.find((b) => b.children.map((o) => o.id).includes(r.id));

    let lastBundleId: string | undefined;
    return (
      <div className={depth > 0 ? "ml-5" : ""}>
        {children.map(({ relation: childRelation, position }, i) => {
          const firstBundle = findRelationsFirstBundle(childRelation);
          const newBundle = firstBundle?.id !== lastBundleId;
          lastBundleId = firstBundle?.id;
          return (
            <>
              {newBundle && <div className="border-t border-black" />}
              <RelatedObjectView
                key={relationsToPathStr([...pathToParentRelations, childRelation])}
                path={[...pathToParentRelations, childRelation]}
                position={position}
                siblingAbove={children[i - 1]?.relation}
                siblingBelow={children[i + 1]?.relation}
                searchResult={searchResult}
              />
            </>
          );
        })}
      </div>
    );
  },
);

export const getFilteredChildrenAtPath = (
  path: PathLink[],
  viewStore: ViewStore,
  searchResult?: Map<string, boolean>,
) => {
  if (path.length === 0) {
    return [];
  }
  const node = path[path.length - 1].child;
  const grandparent = path[path.length - 2]?.child;
  return node.relationsWithPositions
    .sort((a, b) => comparePositions(a.position, b.position))
    .filter(({ relation }) => {
      let childNode: GraphObject;
      if (relation.from.id === node.id) {
        childNode = relation.to;
      } else if (relation.to.id === node.id) {
        childNode = relation.from;
      } else {
        throw new Error("Relation does not connect to parent");
      }
      const isBundle = childNode instanceof GraphNode && childNode.isBundle;
      return (
        !(viewStore.hideBundles && isBundle) &&
        filterFocusedNodesRelations(viewStore, relation, childNode, grandparent) &&
        (!searchResult || searchResult.get(childNode.id))
      );
    });
};
