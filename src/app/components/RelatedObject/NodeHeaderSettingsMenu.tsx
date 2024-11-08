import { ClipboardCopy, Download, Ellipsis, Globe, List, Lock, Plus, Trash2 } from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SetPublicDialog } from "@/app/components/SetPublicDialog/SetPublicDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/UIPrimitives/DropdownMenu";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { getAncestorsAsArray, useSetRoot } from "@/app/tree/utils";
import { createRouteUrl, downloadSubtree } from "@/app/util";

import styles from "./styles/NodeHeaderSettingsMenu.module.css";

interface Props {
  treeNode: DescendantTreeNode | RootTreeNode;
}

export const NodeHeaderSettingsMenu = observer(function NodeHeaderSettingsMenu({ treeNode }: Props) {
  const graphStore = useGraphStore();
  const tree = useTree();
  const router = useRouter();
  const setRoot = useSetRoot();

  const [publicDialogOpen, setPublicDialogOpen] = useState(false);

  return (
    <div className={styles.MenuTrigger}>
      <div className={styles.MenuIcon}>
        <DropdownMenu>
          <DropdownMenuTrigger className={styles.MenuTrigger}>
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

            <DropdownMenuItem onSelect={() => setPublicDialogOpen(true)}>
              {treeNode.object.isPublic ? <Lock size={14} /> : <Globe size={14} />}
              {treeNode.object.isPublic ? "Make private" : "Make public"}
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
            {treeNode.object.isRoot && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={action(async () => {
                    if (window.confirm("Are you sure you want to delete this node and all its relations?")) {
                      const ancestors = getAncestorsAsArray(treeNode);
                      const parentAncestor = ancestors[ancestors.length - 1];

                      await graphStore.removeNode({ nodeId: treeNode.object.id });

                      // navigate to parent, otherwise home
                      setRoot({
                        object: parentAncestor?.object || graphStore.homeRoot,
                        relations: ancestors.slice(0, -1).map((ancestor) => ancestor.relationToChild),
                      });
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
