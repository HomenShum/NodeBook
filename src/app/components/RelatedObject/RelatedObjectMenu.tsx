import {
  Beaker,
  ClipboardCopy,
  Delete,
  Download,
  Edit,
  Ellipsis,
  Expand,
  GitCompare,
  Globe,
  Link,
  Lock,
  Notebook,
  Pin,
  PinOff,
  Plus,
  RefreshCcwDot,
  User,
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
import { useParseWithAi } from "@/app/llm/useParseWithAi";
import { getAncestorsAsArray, useSetAuthorRoot, useSetRoot } from "@/app/tree/utils";
import { createRouteUrl, downloadSubtree } from "@/app/util";

import { useTreeNode } from "./RelatedObjectContext";
import styles from "./styles/RelatedObjectMenu.module.css";

interface Props {
  setUpdatingRelationType: (v: boolean) => void;
  isHovered: boolean;
}

export const RelatedObjectMenu = observer(function RelatedObjectMenu({ setUpdatingRelationType, isHovered }: Props) {
  const user = useUser();
  const graphStore = useGraphStore();
  const { treeNode, viewType, setViewType } = useTreeNode();
  const tree = treeNode.tree;
  const object = treeNode.object;
  const parent = treeNode.parent.object;
  const relation = treeNode.relationWithParent;

  const setRoot = useSetRoot();
  const setAuthorRoot = useSetAuthorRoot();
  const handleZoom = useCallback(() => {
    setRoot(treeNode.object);
  }, [treeNode, setRoot]);

  const parseWithAi = useParseWithAi();

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
      {
        <DropdownMenuItem
          onSelect={() => {
            setAuthorRoot(treeNode.object.authorId);
          }}
        >
          <User size={14} />
          <span>Go to author node</span>
        </DropdownMenuItem>
      }
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
          const path = createRouteUrl({
            object: treeNode.object,
            relations: getAncestorsAsArray(treeNode).map((node) => node.relationToChild),
          });
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
      {treeNode.parent.object.canonicalRelation?.id !== treeNode.relationWithParent.id && (
        <DropdownMenuItem
          onSelect={async () => {
            await graphStore.updateNode({
              nodeId: treeNode.parent.object.id,
              nodeProps: { canonicalRelationId: treeNode.relationWithParent.id },
            });
            // The tree holds a static array of the path ids, so doesn't re-render automatically
            // when we update the canonical relation. So we force a re-render by re-setting the root
            // which will re-compute the path ids according to the new canonical relation.
            tree.setRoot(tree.rootObject);
          }}
        >
          <Link size={14} />
          Make relation canonical
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      {object instanceof GraphNode && (
        <>
          <DropdownMenuItem onSelect={() => parseWithAi(object)}>
            <Beaker size={14} />
            Parse with AI
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
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
