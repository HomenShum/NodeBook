import {
  ClipboardCopy,
  Delete,
  Download,
  Edit,
  Ellipsis,
  Expand,
  GitCompare,
  Globe,
  Lock,
  Notebook,
  Pin,
  PinOff,
  Plus,
  RefreshCcwDot,
} from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";

import { SetPublicDialog } from "@/app/components/SetPublicDialog/SetPublicDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { GraphNode } from "@/app/graph/GraphNode";
import { useTree } from "@/app/tree/TreeContext";
import { getAncestorsAsArray, useSetRoot } from "@/app/tree/utils";
import { createRouteUrl, downloadSubtree } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";

import { useTreeNode } from "./RelatedObjectContext";
import styles from "./styles/RelatedObjectMenu.module.css";

interface Props {
  setUpdatingRelationType: (v: boolean) => void;
  isHovered: boolean;
}

export const RelatedObjectMenu = observer(function RelatedObjectMenu({ setUpdatingRelationType, isHovered }: Props) {
  const user = useUser();
  const graphStore = useGraphStore();
  const tree = useTree();
  const viewStore = useViewStore();
  const { treeNode, viewType, setViewType } = useTreeNode();
  const object = treeNode.object;
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;

  const setRoot = useSetRoot();
  const handleZoom = useCallback(() => {
    setRoot({
      object: treeNode.object,
      relations: getAncestorsAsArray(treeNode).map((node) => node.relationToChild),
    });
  }, [treeNode, setRoot]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [publicDialogOpen, setPublicDialogOpen] = useState(false);

  if (!isHovered && !menuOpen) {
    return <Ellipsis size={16} className={styles.Transparent} />;
  }

  const dropdownMenuItems = user.isAnonymous ? (
    <>
      <DropdownMenuItem onClick={handleZoom}>
        <Expand size={14} />
        Zoom to node
      </DropdownMenuItem>
    </>
  ) : (
    <>
      {object instanceof GraphNode &&
        (treeNode.parentGroup.id === "noteContent" ? (
          <DropdownMenuItem
            onSelect={() => {
              graphStore.applyCombinedTransaction([
                {
                  type: "removeRelationFromList",
                  transaction: {
                    objectId: treeNode.parent.object.id,
                    relationId: treeNode.relationWithParent.id,
                    listType: "noteContent",
                  },
                },
              ]);
            }}
          >
            <Notebook size={14} />
            <span>Remove from note</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onSelect={() => {
              graphStore.applyCombinedTransaction([
                {
                  type: "addRelationToList",
                  transaction: {
                    objectId: treeNode.parent.object.id,
                    relationId: treeNode.relationWithParent.id,
                    listType: "noteContent",
                  },
                },
              ]);
            }}
          >
            <Notebook size={14} />
            <span>Add to note</span>
          </DropdownMenuItem>
        ))}
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
      <DropdownMenuItem onSelect={() => setPublicDialogOpen(true)}>
        {object.isPublic ? <Lock size={14} /> : <Globe size={14} />}
        {object.isPublic ? "Make private" : "Make public"}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleZoom}>
        <Expand size={14} />
        Zoom to node
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={action(async () => {
          await graphStore.addChildNode({ parentId: object.id });
          tree.setPathExpanded(treeNode.path, true);
        })}
      >
        <Plus size={14} />
        Add child
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={action(async () => {
          const domain = `${window.location.protocol}//${window.location.host}`;
          const path = createRouteUrl(`${treeNode.path}/${treeNode.object.id}`);
          await navigator.clipboard.writeText(`${domain}${path}`);
        })}
      >
        <ClipboardCopy size={14} />
        Copy URL
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
      <DropdownMenuItem onSelect={() => downloadSubtree(graphStore, object)}>
        <Download size={14} />
        Export subtree
      </DropdownMenuItem>
    </>
  );

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger className={styles.TrailMenuTrigger}>
        <Ellipsis size={16} className={styles.TrailMenuIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" alignOffset={-5} onCloseAutoFocus={(e) => e.preventDefault()}>
        {dropdownMenuItems}
      </DropdownMenuContent>
      <SetPublicDialog isOpen={publicDialogOpen} setOpen={setPublicDialogOpen} treeNode={treeNode} />
    </DropdownMenu>
  );
});
