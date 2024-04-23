import { observer } from "mobx-react-lite";
import { useCallback } from "react";
import { useViewController } from "../controller/useViewController";
import { searchGraph } from "../store/search";
import { relationsPathToParentChild } from "../util";
import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

export const OutlineView = observer(({ searchQuery }: { searchQuery: string }) => {
  const viewController = useViewController();

  const relations = viewController.currentOutlineViewRoot;
  if (relations === null) {
    return <div>Root path is null</div>;
  }

  const path = relationsPathToParentChild(relations);

  const root = path[path.length - 1].child;
  const searchResult = searchQuery ? searchGraph(root, searchQuery) : undefined;

  if (!root) {
    return <div>Missing root node</div>;
  }

  const createChild = useCallback(() => {
    viewController.createAndFocusChildNode();
  }, [viewController]);

  return (
    <div className="w-full px-8 flex flex-col gap-4" style={{ maxWidth: 1000 }}>
      <div className="ml-2">
        <div>
          {path.slice(0, path.length - 1).map(({ relation, child }, i) => {
            return (
              <span
                key={relation.id}
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => {
                  viewController.setCurrentOutlineViewRoot(relations.slice(0, i + 1));
                }}
              >
                {child.text} /{" "}
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
      <RelatedObjectChildren pathToParentRelations={relations} searchResult={searchResult} />
    </div>
  );
});
