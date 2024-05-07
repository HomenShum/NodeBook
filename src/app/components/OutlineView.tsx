import { ChevronRight, Home, HomeIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback } from "react";
import { ViewType } from "../controller/ViewController";
import { useViewController } from "../controller/useViewController";
import { searchGraph } from "../store/search";
import { useGraphStore } from "../store/useGraphStore";
import { relationsPathToParentChild } from "../util";
import s from "./OutlineView.module.css";
import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

export const OutlineView = observer(({ searchQuery }: { searchQuery: string }) => {
  const viewController = useViewController();
  const graphStore = useGraphStore();

  const relations = viewController.currentOutlineViewRoot;
  if (relations === null) {
    return <div>Root path is null</div>;
  }

  const path = relationsPathToParentChild(relations);
  const nodeAtPathEnd = path[path.length - 1].child;
  const searchResult = searchQuery ? searchGraph(nodeAtPathEnd, searchQuery) : undefined;

  if (!nodeAtPathEnd) {
    return <div>Missing root node</div>;
  }

  const createChild = useCallback(() => {
    viewController.createChildNode({ focusAfterCreate: true, targetView: ViewType.OUTLINE });
  }, [viewController]);

  return (
    <div className={s.OutlineView}>
      <div className={s.OutlineContainer}>
        {path.length > 1 && (
          <div className={s.BreadcrumbContainer}>
            {path.map(({ relation, child }, i) => (
              <span className={s.Breadcrumb} key={relation.id}>
                {/* Home icon before the first item */}
                {i === 0 && <HomeIcon size={14} />}
                {/* Chevron only between items, not before the first item */}
                {i !== 0 && <ChevronRight size={14} strokeWidth={2} />}
                <span onClick={() => viewController.setCurrentOutlineViewRoot(relations.slice(0, i + 1))}>
                  {child.text}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className={s.TitleContainer}>
          {nodeAtPathEnd.id === graphStore.outlineRoot.id && <Home className={s.HomeIcon} size={20} />}
          <h1 className={s.TitleText}>{nodeAtPathEnd.text}</h1>
          <button className={s.AddButton} onClick={createChild}>
            <span className={s.AddButtonIcon}>+</span>
          </button>
        </div>
        <RelatedObjectChildren pathToParentRelations={relations} searchResult={searchResult} />
      </div>
    </div>
  );
});
