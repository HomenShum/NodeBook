import { observer } from "mobx-react-lite";
import { useCallback, useMemo } from "react";
import { useViewController } from "../controller/useViewController";
import { searchGraph } from "../store/search";
import { useGraphStore } from "../store/useGraphStore";
import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

export const ThoughtstreamView = observer(({ searchQuery }: { searchQuery: string }) => {
  const viewController = useViewController();
  const graphStore = useGraphStore();
  const pathToThoughtstream = useMemo(
    () => [graphStore.thoughtstreamRootRelationFromUserRoot],
    [graphStore.thoughtstreamRootRelationFromUserRoot],
  );
  const thoughstreamNode = graphStore.thoughtstreamRoot;
  const searchResult = useMemo(
    () => (searchQuery ? searchGraph(thoughstreamNode, searchQuery) : undefined),
    [thoughstreamNode, searchQuery],
  );

  const createChild = useCallback(() => {
    viewController.createAndFocusChildNode();
  }, [viewController]);

  return (
    <div tabIndex={0} className="w-full h-full flex flex-col px-8 gap-4">
      <div className="ml-2">
        <div className="flex align-center gap-2">
          <h1 className="text-2xl font-medium select-none">{thoughstreamNode.text}</h1>
          <button
            className="select-none text-xl font-light bg-slate-50 hover:bg-slate-200 hover:shadow-inner transition-colors duration-150 ease-in w-6 h-6 text-center rounded-lg relative translate-y-1"
            onClick={createChild}
          >
            <span className="absolute -translate-x-[6px] -translate-y-[15px]">+</span>
          </button>
        </div>
      </div>
      <div className="flex-1">
        <RelatedObjectChildren pathToParentRelations={pathToThoughtstream} searchResult={searchResult} />
      </div>
    </div>
  );
});
