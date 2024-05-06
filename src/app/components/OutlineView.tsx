import { ChevronRight, Home } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback } from "react";
import { useViewController } from "../controller/useViewController";
import { searchGraph } from "../store/search";
import { relationsPathToParentChild } from "../util";
import s from "./OutlineView.module.css";
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
    viewController.createChildNode();
  }, [viewController]);

  return (
    <div className={s.OutlineView}>
      <div className={s.OutlineContainer}>
        <div className={s.BreadcrumbContainer}>
          {path.slice(0, path.length - 1).map(({ relation, child }, i) => (
            <span className={s.Breadcrumb} key={relation.id}>
              {path.length > 2 && i !== 0 && <ChevronRight size={14} strokeWidth={2} />}
              <span onClick={() => viewController.setCurrentOutlineViewRoot(relations.slice(0, i + 1))}>
                {child.text}
              </span>
            </span>
          ))}
        </div>

        <div className={s.TitleContainer}>
          {root.text === "My Lists" && <Home size={20} />}
          <h1 className={s.TitleText}>{root.text}</h1>
          <button className={s.AddButton} onClick={createChild}>
            <span className={s.AddButtonIcon}>+</span>
          </button>
        </div>
        <RelatedObjectChildren pathToParentRelations={relations} searchResult={searchResult} />
      </div>
    </div>
  );
});
