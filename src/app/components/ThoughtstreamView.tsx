import { ChevronRight } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useMemo } from "react";
import { ViewType } from "../controller/ViewController";
import { useViewController } from "../controller/useViewController";
import { searchGraph } from "../store/search";
import { useGraphStore } from "../store/useGraphStore";
import { relationsPathToParentChild } from "../util";
import stylesList from "./OutlineView.module.css";
import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";
import stylesStream from "./ThoughtstreamView.module.css";

export const ThoughtstreamView = observer(({ searchQuery }: { searchQuery: string }) => {
  const viewController = useViewController();
  const graphStore = useGraphStore();

  const relations = viewController.currentStreamViewRoot;
  if (relations === null) {
    return <div>Stream path is null</div>;
  }
  const path = relationsPathToParentChild(relations);
  const nodeAtPathEnd = path[path.length - 1].child;

  const thoughstreamNode = graphStore.thoughtstreamRoot;
  const searchResult = useMemo(
    () => (searchQuery ? searchGraph(thoughstreamNode, searchQuery) : undefined),
    [thoughstreamNode, searchQuery],
  );

  const createChild = useCallback(() => {
    viewController.createChildNode({ focusAfterCreate: true, targetView: ViewType.THOUGHTSTREAM });
  }, [viewController]);

  return (
    <div tabIndex={0} className={stylesStream.StreamContainer}>
      <div className={stylesStream.ContentSection}>
        {path.length > 1 && (
          <div className={stylesList.BreadcrumbContainer}>
            {path.map(({ relation, child }, i) => (
              <span className={stylesList.Breadcrumb} key={relation.id}>
                {/* Chevron only between items, not before the first item */}
                {i !== 0 && <ChevronRight size={14} strokeWidth={2} />}
                <span onClick={() => viewController.setCurrentStreamViewRoot(relations.slice(0, i + 1))}>
                  {child.text}
                </span>
              </span>
            ))}
          </div>
        )}
        <div className={stylesList.TitleContainer}>
          {viewController.curView === ViewType.SPLIT && <h1 className={stylesList.TitleText}>{nodeAtPathEnd.text}</h1>}
          <button className={stylesList.AddButton} onClick={createChild}>
            <span className={stylesList.AddButtonIcon}>+</span>
          </button>
        </div>
      </div>
      <div className={stylesList.relatedObjectsContainer}>
        <RelatedObjectChildren pathToParentRelations={relations} searchResult={searchResult} />
      </div>
    </div>
  );
});
