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

import styles from "./NodeHeaderSettingsMenu.module.css";

export const NodeHeaderSettingsMenu = observer(({ treeNode }: { treeNode: DescendantTreeNode | RootTreeNode }) => {
  const graphStore = useGraphStore();
  const tree = useTree();

  const [publicDialogOpen, setPublicDialogOpen] = useState(false);

  return (
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
        <DropdownMenuItem
          onSelect={() => {
            const subtreeData = JSON.stringify(graphStore.serializeSubtree(treeNode.object));
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
        objectId={treeNode.object.id}
        relationId={treeNode.relationWithParent?.id}
        isPublic={!treeNode.object.isPublic}
      />
    </DropdownMenu>
  );
});
