import {
  Delete,
  Download,
  Edit,
  Ellipsis,
  GitCompare,
  Globe,
  Lock,
  Pin,
  PinOff,
  Plus,
  RefreshCcwDot,
} from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import { SetPublicDialog } from "@/app/components/SetPublicDialog/SetPublicDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useTree } from "@/app/tree/TreeContext";
import { useViewStore } from "@/app/view/useViewStore";

import { useTreeNode } from "./RelatedObjectContext";
import styles from "./styles/RelatedObjectMenu.module.css";

export const RelatedObjectMenu = observer(
  ({ setUpdatingRelationType, isHovered }: { setUpdatingRelationType: (v: boolean) => void; isHovered: boolean }) => {
    const graphStore = useGraphStore();
    const tree = useTree();
    const viewStore = useViewStore();
    const { treeNode, viewType, setViewType } = useTreeNode();
    const object = treeNode.object;
    const parent = treeNode.parent.object;
    const relation = treeNode.relationWithParent;

    const [menuOpen, setMenuOpen] = useState(false);
    const [publicDialogOpen, setPublicDialogOpen] = useState(false);

    if (viewStore.flattenSublists) {
      return null;
    }

    if (!isHovered && !menuOpen) {
      return <Ellipsis size={16} className={styles.Transparent} />;
    }
    return (
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger className={styles.TrailMenuTrigger}>
          <Ellipsis size={16} className={styles.TrailMenuIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" alignOffset={-5} onCloseAutoFocus={(e) => e.preventDefault()}>
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
              await graphStore.addChildNode({ parentId: object.id });
              tree.setPathExpanded(treeNode.path, true);
            })}
          >
            <Plus size={14} />
            Add child
            {/* <DropdownMenuShortcut>⌘K</DropdownMenuShortcut> */}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={action(async () => {
              try {
                await graphStore.removeRelation({ relationId: relation.id });
                if (treeNode.siblingAbove) {
                  tree.setFocusedNode(treeNode.siblingAbove.path);
                }
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to delete relation");
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
          <DropdownMenuItem onSelect={() => setPublicDialogOpen(true)}>
            {object.isPublic ? <Lock size={14} /> : <Globe size={14} />}
            {object.isPublic ? "Make private" : "Make public"}
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
        </DropdownMenuContent>
        <SetPublicDialog
          isOpen={publicDialogOpen}
          setOpen={setPublicDialogOpen}
          objectId={object.id}
          relationId={relation.id}
          isPublic={!object.isPublic}
        />
      </DropdownMenu>
    );
  },
);
