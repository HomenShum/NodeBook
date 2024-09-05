import {
  Download,
  Ellipsis, Globe,
  Lock, Plus
} from "lucide-react";
import { action } from "mobx";
import { observer } from "mobx-react-lite";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/app/components/UIPrimitives/DropdownMenu";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { DescendantTreeNode, RootTreeNode } from '@/app/tree/nodes';
import { useTree } from "@/app/tree/TreeContext";
import { cn } from "@/lib/utils";

import styles from "./NodeHeaderSettingsMenu.module.css";

export const NodeHeaderSettingsMenu = observer(
  ({ treeNode }: { treeNode: DescendantTreeNode | RootTreeNode }) => {
    const graphStore = useGraphStore();
    const tree = useTree();

    return (
      <DropdownMenu>
        <DropdownMenuTrigger className={styles.MenuTrigger}>
          <Ellipsis size={16} className={cn(styles.MenuIcon, styles.Transparent)} />
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

          <DropdownMenuItem
            onSelect={action(() => {
              treeNode.object.setIsPrivate(!treeNode.object.isPrivate);
            })}
          >
            {treeNode.object.isPrivate ? <Globe size={14} /> : <Lock size={14} />}
            {treeNode.object.isPrivate ? "Make public" : "Make private"}
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
      </DropdownMenu>
    );
  },
);