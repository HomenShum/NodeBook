import { Ellipsis } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useViewController } from "@/app/controller/useViewController";
import { GraphNode } from "@/app/model/GraphNode";
import { useGraphStore } from "@/app/model/useGraphStore";
import { relationsToPathStr } from "@/app/util";
import { cn } from "@/lib/utils";
import { useRelationAtPath } from "./RelatedObjectContext";

export const RelatedObjectMenu = observer(
  ({ setUpdatingRelationType, isHovered }: { setUpdatingRelationType: (v: boolean) => void; isHovered: boolean }) => {
    const viewController = useViewController();
    const graphStore = useGraphStore();
    const { object, parent, relation, pathToParentRelations, siblingAbove, viewType, setViewType } =
      useRelationAtPath();

    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="mx-2">
          <Ellipsis size={18} className={cn(isHovered ? "text-[var(--gray-8)] bg-white" : "text-transparent")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          {parent.isRelationPinned(relation) ? (
            <DropdownMenuItem onSelect={() => parent.unpinChildRelation(relation)}>Unpin</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => parent.pinChildRelation(relation)}>Pin</DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={action(() => {
              graphStore.deleteRelation(relation);
              if (siblingAbove) {
                const pathStr = relationsToPathStr([...pathToParentRelations, siblingAbove]);
                viewController.setFocusedNode(pathStr);
              }
            })}
          >
            Delete relation
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setViewType("replace")}>Replace related object</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={action(() => {
              object.setIsPrivate(!object.isPrivate);
            })}
          >
            {object.isPrivate ? "Make public" : "Make private"}
          </DropdownMenuItem>
          {viewType !== "edit" && (
            <DropdownMenuItem
              onSelect={() => {
                setViewType("edit");
              }}
            >
              Set to edit view
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setUpdatingRelationType(true)}>Change relation type</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={action(() => {
              graphStore.createChildNode(object);
              const pathStr = relationsToPathStr([...pathToParentRelations, relation]);
              graphStore.setPathExpanded(pathStr, true);
            })}
          >
            Add child
          </DropdownMenuItem>
          {/* toggle bundle */}
          {object instanceof GraphNode &&
            (object.isBundle ? (
              <DropdownMenuItem onSelect={() => object.setIsBundle(false)}>Unset as bundle</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => object.setIsBundle(true)}>Set as bundle</DropdownMenuItem>
            ))}
          {/* toggle zone */}
          {object instanceof GraphNode &&
            (object.isZone ? (
              <DropdownMenuItem onSelect={() => object.setIsZone(false)}>Unset as zone</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => object.setIsZone(true)}>Set as zone</DropdownMenuItem>
            ))}
          <DropdownMenuItem
            onSelect={() => {
              const subtreeData = JSON.stringify(graphStore.serializeSubtree(object)); // TODO
              const blob = new Blob([subtreeData], { type: "application/json" });

              // Create a temporary URL for the Blob
              const url = URL.createObjectURL(blob);

              // Create a link element and trigger the download
              const link = document.createElement("a");
              link.href = url;
              link.download = "data.json";
              link.click();

              // Clean up the temporary URL
              URL.revokeObjectURL(url);
            }}
          >
            Export subtree
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              graphStore.deleteSubtree(object);
            }}
          >
            Delete subtree
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
