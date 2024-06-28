import {
  Delete,
  Download,
  Edit,
  Ellipsis,
  GanttChart,
  GanttChartSquare,
  GitCompare,
  Globe,
  Lock,
  Pin,
  PinOff,
  Plus,
  RefreshCcwDot,
  Scan,
  ScanLine,
  Trash2,
} from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { GraphNode } from "@/app/graph/GraphNode";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useTree } from "@/app/view/TreeContext";
import { cn } from "@/lib/utils";

import { useTreeNode } from "./RelatedObjectContext";

import styles from "./RelatedObjectMenu.module.css";

export const RelatedObjectMenu = observer(
  ({ setUpdatingRelationType, isHovered }: { setUpdatingRelationType: (v: boolean) => void; isHovered: boolean }) => {
    const graphStore = useGraphStore();
    const tree = useTree();
    const { treeNode, viewType, setViewType } = useTreeNode();
    const object = treeNode.object;
    const parent = treeNode.parent.object;
    const relation = treeNode.relationWithParent;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={styles.TrailMenuTrigger}>
          <Ellipsis size={16} className={cn(isHovered ? styles.TrailMenuIcon : styles.Transparent)} />
        </DropdownMenuTrigger>
        <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          {parent.isRelationPinned(relation) ? (
            <DropdownMenuItem onSelect={() => parent.unpinChildRelation(relation)}>
              <PinOff size={14} />
              Unpin
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => parent.pinChildRelation(relation)}>
              <Pin size={14} />
              Pin
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={action(async () => {
              await graphStore.removeRelation({ relationId: relation.id });
              if (treeNode.siblingAbove) {
                tree.setFocusedNode(treeNode.siblingAbove.path);
              }
            })}
          >
            <Delete size={14} />
            Delete relation
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setViewType("replace")}>
            <GitCompare size={14} />
            Replace related object
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={action(() => {
              object.setIsPrivate(!object.isPrivate);
            })}
          >
            {object.isPrivate ? <Globe size={14} /> : <Lock size={14} />}
            {object.isPrivate ? "Make public" : "Make private"}
          </DropdownMenuItem>
          {viewType !== "edit" && (
            <DropdownMenuItem
              onSelect={() => {
                setViewType("edit");
              }}
            >
              <Edit size={14} />
              Set to edit view
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setUpdatingRelationType(true)}>
            <RefreshCcwDot size={14} />
            Change relation type
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={action(async () => {
              await graphStore.addChildNode({ parentId: object.id });
              tree.setPathExpanded(treeNode.path, true);
            })}
          >
            <Plus size={14} />
            Add child <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
          </DropdownMenuItem>
          {/* toggle bundle */}
          {object instanceof GraphNode &&
            (object.isBundle ? (
              <DropdownMenuItem onSelect={() => object.setIsBundle(false)}>
                <GanttChart size={14} />
                Unset as bundle
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => object.setIsBundle(true)}>
                <GanttChartSquare size={14} />
                Set as bundle
              </DropdownMenuItem>
            ))}
          {/* toggle zone */}
          {object instanceof GraphNode &&
            (object.isZone ? (
              <DropdownMenuItem onSelect={() => object.setIsZone(false)}>
                <ScanLine size={14} />
                Unset as zone
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => object.setIsZone(true)}>
                <Scan size={14} />
                Set as zone
              </DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              const subtreeData = JSON.stringify(graphStore.serializeSubtree(object));
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
            <Download size={14} />
            Export subtree
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              graphStore.deleteSubtree(object);
            }}
          >
            <Trash2 size={14} />
            Delete subtree
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
