import { Download, Ellipsis, Globe, Lock, Plus } from "lucide-react";
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
import { DescendantTreeNode, RootTreeNode } from "@/app/tree/nodes";
import { useTree } from "@/app/tree/TreeContext";
import { downloadSubtree } from "@/app/util";

import styles from "./styles/NodeHeaderSettingsMenu.module.css";

export const NodeHeaderSettingsMenu = observer(({ treeNode }: { treeNode: DescendantTreeNode | RootTreeNode }) => {
  const graphStore = useGraphStore();
  const tree = useTree();

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
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => downloadSubtree(graphStore, treeNode.object)}>
              <Download size={14} />
              Export subtree
            </DropdownMenuItem>
          </DropdownMenuContent>
          <SetPublicDialog
            isOpen={publicDialogOpen}
            setOpen={setPublicDialogOpen}
            objectId={treeNode.object.id}
            relationId={treeNode.relationWithParent?.id}
            isPublic={!treeNode.object.isPublic}
          />
        </DropdownMenu>
      </div>
    </div>
  );
});
