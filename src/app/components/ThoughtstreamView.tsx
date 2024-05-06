import { observer } from "mobx-react-lite";
import { useCallback, useMemo } from "react";
import { useViewController } from "../controller/useViewController";
import { searchGraph } from "../store/search";
import { useGraphStore } from "../store/useGraphStore";
import stylesList from "./OutlineView.module.css";
import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";
import stylesStream from "./ThoughtstreamView.module.css";

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
    <div tabIndex={0} className={stylesStream.StreamContainer}>
      <div className={stylesStream.ContentSection}>
        <div className={stylesList.TitleContainer}>
          <h1 className={stylesList.TitleText}>{thoughstreamNode.text}</h1>
          <button className={stylesList.AddButton} onClick={createChild}>
            <span className={stylesList.AddButtonIcon}>+</span>
          </button>
        </div>
      </div>
      <div className={stylesList.relatedObjectsContainer}>
        <RelatedObjectChildren pathToParentRelations={pathToThoughtstream} searchResult={searchResult} />
      </div>
    </div>
  );
});
