import { observer } from "mobx-react-lite";
import { useCallback } from "react";
import { searchGraph } from "../store/search";
import { useGraphStore } from "../store/useGraphStore";
import { useViewStore } from "../store/useViewStore";
import { relationsToNodes, relationsToPathStr } from "../util";
import { RelatedNodeChildren } from "./RelatedNode/RelatedNodeChildren";

export const OutlineView = observer(({ searchQuery }: { searchQuery: string }) => {
  const viewStore = useViewStore();
  const graphStore = useGraphStore();

  const relations = viewStore.currentOutlineViewRoot;
  if (relations === null) {
    return <div>Root path is null</div>;
  }

  const nodes = relationsToNodes(relations);
  const relation = relations[relations.length - 1];
  const root = nodes[nodes.length - 1];
  let searchResult;
  if (searchQuery) {
    searchResult = searchGraph(root, searchQuery);
  }

  if (!root) {
    return <div>Missing root node</div>;
  }

  const createChild = useCallback(() => {
    const { relation } = graphStore.createChildNode(root);
    viewStore.setFocusedNode(relationsToPathStr([...relations, relation]));
  }, [root, graphStore, viewStore, relations]);

  return (
    <div
      className="w-full px-8 flex flex-col gap-4"
      style={{ maxWidth: 1000 }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          createChild();
        }
      }}
    >
      <div className="ml-2">
        <div>
          {nodes.slice(0, relations.length - 1).map((node, i) => {
            // TODO
            const relation = relations[i];
            return (
              <span
                key={relation.id}
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => {
                  viewStore.setCurrentOutlineViewRoot(relations.slice(0, i + 1));
                }}
              >
                {node.text} /{" "}
              </span>
            );
          })}
        </div>
        <div className="flex align-center gap-2">
          <h1 className="text-2xl font-medium select-none">{root.text}</h1>
          <button
            className="select-none text-xl font-light bg-slate-50 hover:bg-slate-200 hover:shadow-inner transition-colors duration-150 ease-in w-6 h-6 text-center rounded-lg relative translate-y-1"
            onClick={createChild}
          >
            <span className="absolute -translate-x-[6px] -translate-y-[15px]">+</span>
          </button>
        </div>
      </div>
      {/* <BulletChildren bullet={root} depth={0} parents={[...ancestors, root]} /> */}
      <RelatedNodeChildren pathToParentRelations={relations} searchResult={searchResult} />
    </div>
  );
});
