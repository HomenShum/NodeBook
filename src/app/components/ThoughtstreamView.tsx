import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { ChevronRight, Ellipsis } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { ViewType } from "../controller/ViewController";
import { useViewController } from "../controller/useViewController";
import { searchGraph } from "../store/search";
import { useGraphStore } from "../store/useGraphStore";
import { relationsPathToParentChild, relationsToURLPath, useCurView } from "../util";
import stylesList from "./OutlineView.module.css";
import RelatedObjectChildren from "./RelatedObject/RelatedObjectChildren";
import stylesStream from "./ThoughtstreamView.module.css";

const truncateText = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
};

export const ThoughtstreamView = observer(() => {
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
    () => (viewController.searchQuery ? searchGraph(thoughstreamNode, viewController.searchQuery) : undefined),
    [thoughstreamNode, viewController.searchQuery],
  );

  const createChild = useCallback(() => {
    viewController.createChildNode({ focusAfterCreate: true, targetView: ViewType.THOUGHTSTREAM });
  }, [viewController]);

  const isLong = path.length > 5 || path.reduce((total, { child }) => total + child.text.length, 0) > 50;
  const curView = useCurView();
  const router = useRouter();

  return (
    <div tabIndex={0} className={stylesStream.StreamContainer}>
      <div className={stylesStream.ContentSection}>
        {path.length > 1 && (
          <div className={stylesList.BreadcrumbContainer}>
            {path.map(({ relation, child }, i) => {
              const isFirst = i === 0;
              const isLast = i === path.length - 1;

              if (isFirst || isLast) {
                return (
                  <span
                    className={stylesList.Breadcrumb}
                    key={relation.id}
                    onClick={() => {
                      if (curView !== ViewType.SPLIT) {
                        router.push(`/stream${relationsToURLPath(relations.slice(0, i + 1))}`);
                      }
                    }}
                  >
                    {!isFirst && <ChevronRight size={14} strokeWidth={2} />}
                    <span>{truncateText(child.text, 20)}</span>
                  </span>
                );
              }

              if (isLong && i === 1) {
                return (
                  <DropdownMenu key="ellipsis">
                    <DropdownMenuTrigger asChild>
                      <span className={stylesList.Breadcrumb}>
                        <ChevronRight size={14} />
                        <Ellipsis size={14} />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={stylesList.BreadcrumbDropdownMenu} align="start" sideOffset={5}>
                      {path.slice(1, -1).map(({ relation, child }, index) => (
                        <DropdownMenuItem
                          key={relation.id}
                          className={stylesList.BreadcrumbMenuItem}
                          onSelect={() => {
                            if (curView !== ViewType.SPLIT) {
                              router.push(`/stream${relationsToURLPath(relations.slice(0, index + 2))}`);
                            }
                          }}
                        >
                          {truncateText(child.text, 20)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              return !isLong ? (
                <span
                  className={stylesList.Breadcrumb}
                  key={relation.id}
                  onClick={() => {
                    if (curView !== ViewType.SPLIT) {
                      router.push(`/stream${relationsToURLPath(relations.slice(0, i + 1))}`);
                    }
                  }}
                >
                  <ChevronRight size={14} strokeWidth={2} />
                  <span>{truncateText(child.text, 20)}</span>
                </span>
              ) : null;
            })}
          </div>
        )}
        <div className={stylesList.TitleContainer}>
          {(curView === ViewType.SPLIT || path.length > 1) && (
            <h1 className={stylesList.TitleText}>{truncateText(nodeAtPathEnd.text, 20)}</h1>
          )}
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
