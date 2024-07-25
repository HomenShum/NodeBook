import { ChevronRight, Ellipsis, Plus } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";

import { Button } from "@/app/components/UIPrimitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { Tree } from "@/app/tree/Tree";
import { TreeContext } from "@/app/tree/TreeContext";
import { getAncestorsAsArray } from "@/app/tree/utils";
import { createRouteUrl, ViewType } from "@/app/view/ViewType";

import breadcrumb from "./Breadcrumbs/Breadcrumbs.module.css";
import { RelatedObjectChildren } from "./RelatedObject/RelatedObjectChildren";

import stylesList from "./OutlineView.module.css";
import stylesStream from "./ThoughtstreamView.module.css";

const truncateText = (text: string, maxLength: number) => {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }
  return text;
};

export const ThoughtstreamView = observer(({ tree }: { tree: Tree }) => {
  const router = useRouter();

  const { root: treeNode } = tree.state;
  const ancestors = getAncestorsAsArray(treeNode);
  const isLong = treeNode.depth > 5 || ancestors.reduce((total, { object }) => total + object.text.length, 0) > 50;
  const relations = ancestors.map((a) => a.relationToChild);

  return (
    <TreeContext.Provider value={tree}>
      <div id={ViewType.STREAM} tabIndex={0} className={stylesStream.StreamContainer}>
        <div>
          <div className={breadcrumb.BreadcrumbContainer}>
            {ancestors.slice(0, -1).map(({ object, path }, i) => {
              const isFirst = i === 0;
              const isSecondLast = i === ancestors.length - 2;
              if (isFirst || isSecondLast) {
                return (
                  <span
                    className={breadcrumb.Breadcrumb}
                    key={path}
                    onClick={() => {
                      router.push(createRouteUrl(ViewType.STREAM, ...relations.slice(0, i + 1)));
                    }}
                  >
                    {!isFirst && <ChevronRight size={14} strokeWidth={2} />}
                    <span>{truncateText(object.text, 20)}</span>
                  </span>
                );
              }

              if (isLong && i === 1) {
                return (
                  <DropdownMenu key="ellipsis">
                    <DropdownMenuTrigger asChild>
                      <span className={breadcrumb.Breadcrumb}>
                        <ChevronRight size={14} />
                        <Ellipsis size={14} />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={5}>
                      {ancestors.slice(1, -1).map(({ object, relationToChild, path }, index) => (
                        <DropdownMenuItem
                          key={path}
                          onSelect={() => {
                            router.push(createRouteUrl(ViewType.STREAM, ...relations.slice(0, index + 2)));
                          }}
                        >
                          {truncateText(object.text, 20)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              return !isLong ? (
                <span
                  className={breadcrumb.Breadcrumb}
                  key={path}
                  onClick={() => {
                    router.push(createRouteUrl(ViewType.STREAM, ...relations.slice(0, i + 1)));
                  }}
                >
                  <ChevronRight size={14} strokeWidth={2} />
                  <span>{truncateText(object.text, 20)}</span>
                </span>
              ) : null;
            })}
            <span className={breadcrumb.Chevron}>
              <ChevronRight size={14} strokeWidth={2} />
            </span>
          </div>

          <div className={stylesList.HeadingContainer}>
            <div className={stylesList.TitleContainer}>
              {ancestors.length > 1 && <h1 className={stylesList.TitleText}>{treeNode.object.text}</h1>}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await tree.createChildOfRootAndFocus();
              }}
            >
              <Plus size={16}></Plus>
            </Button>
          </div>
        </div>
        <div className={stylesList.Nodes}>
          <RelatedObjectChildren treeNode={treeNode} />
        </div>
      </div>
    </TreeContext.Provider>
  );
});
