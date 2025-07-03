import { Download, Ellipsis, Globe, Link, List, Lock, PanelRightIcon, Plus, Star, Trash2 } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/app/components/OutlineView.module.css";
import { SetPublicDialog } from "@/app/components/SetPublicDialog/SetPublicDialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { addToFavorites, isFavorited, removeFromFavorites } from "@/app/graph/favorites";
import { useToast } from "@/app/hooks/useToast";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { getAncestorsAsArray, treeNodeToObjectPath, useSetMainRoot } from "@/app/tree/utils";
import { copyObjectUrlToClipboard, downloadSubtree, exportSubtreeToIdeapad } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import { cn } from "@/lib/utils";

interface Props {
  treeNode: DescendantTreeNode | RootTreeNode;
}

export const NodeHeaderSettingsMenu = observer(function NodeHeaderSettingsMenu({ treeNode }: Props) {
  const graphStore = useGraphStore();
  const settingsStore = useSettingsStore();
  const tree = treeNode.tree;
  const router = useRouter();
  const setRoot = useSetMainRoot();
  const user = useUser();
  const viewStore = useViewStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const { addToast } = useToast();

  const [publicDialogOpen, setPublicDialogOpen] = useState(false);

  return (
    <div className={styles.MenuTrigger}>
      <div className={styles.MenuIcon}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger className={cn(styles.MenuTrigger, menuOpen && styles.MenuTriggerVisible)}>
            <Ellipsis size={16} className={styles.MenuIcon} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" alignOffset={-5} onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem
              onSelect={action(async () => {
                await graphStore.addChildNode({ parentId: treeNode.object.id });
                tree.setPathExpanded(treeNode.path, true);
              })}
            >
              <Plus size={14} />
              Add child
            </DropdownMenuItem>
            {isFavorited(graphStore, treeNode.object) ? (
              <DropdownMenuItem onSelect={() => removeFromFavorites(graphStore, treeNode.object)}>
                <Star size={14} fill="currentColor" />
                Remove from favorites
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => addToFavorites(graphStore, treeNode.object)}>
                <Star size={14} />
                Add to favorites
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setPublicDialogOpen(true)}>
              {treeNode.object.isPublic ? <Lock size={14} /> : <Globe size={14} />}
              {treeNode.object.isPublic ? "Make private" : "Make public"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                await copyObjectUrlToClipboard(treeNodeToObjectPath(treeNode));
                addToast({
                  title: "Copied page URL to clipboard",
                });
              }}
            >
              <Link size={14} />
              Copy URL
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                viewStore.createSidePanelTree(treeNode.object);
                addToast({
                  title: "Opened in side panel",
                });
              }}
            >
              <PanelRightIcon size={14} />
              Open in Side Panel
            </DropdownMenuItem>
            {treeNode.object.isUserNode && (
              <DropdownMenuItem onSelect={() => router.push(`/all-nodes?authorId=${treeNode.object.authorId}`)}>
                <List size={14} />
                See all nodes
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => downloadSubtree(graphStore, treeNode.object)}>
              <Download size={14} />
              Export subtree
            </DropdownMenuItem>
            {settingsStore.showExportSubtreeToIdeapad && (
              <>
                <DropdownMenuItem onSelect={() => exportSubtreeToIdeapad(graphStore, treeNode.object, user.id)}>
                  <Download size={14} />
                  Export to Ideapad
                </DropdownMenuItem>
              </>
            )}
            {!treeNode.object.isDeleteRestricted && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={action(async () => {
                    if (window.confirm("Are you sure you want to delete this node and all its relations?")) {
                      const ancestors = getAncestorsAsArray(treeNode);
                      const parentAncestor = ancestors[ancestors.length - 1];

                      await graphStore.removeNode({ nodeId: treeNode.object.id });

                      // navigate to parent, otherwise home
                      const object = parentAncestor?.object || graphStore.homeRoot;
                      setRoot(object);
                    }
                  })}
                >
                  <Trash2 size={14} />
                  Delete node
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
          <SetPublicDialog isOpen={publicDialogOpen} setOpen={setPublicDialogOpen} treeNode={treeNode} />
        </DropdownMenu>
      </div>
    </div>
  );
});
