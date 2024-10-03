import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { TreeNode } from "@/app/tree/nodes";

import styles from "./SetPublicDialog.module.css";

interface Props {
  isOpen: boolean;
  setOpen: (v: boolean) => void;
  treeNode: TreeNode;
}

export const SetPublicDialog = observer(function SetPublicDialog({ isOpen, setOpen, treeNode }: Props) {
  const graphStore = useGraphStore();
  const objectId = treeNode.object.id;
  const relationId = treeNode.relationWithParent?.id;
  const isSwitchingToPublic = !treeNode.object.isPublic;

  const [includeRelatedObjects, setIncludeRelatedObjects] = useState(true);
  const [includeChildrenAndDescendants, setIncludeChildrenAndDescendants] = useState(true);
  const [isNewRelatedObjectsPublic, setIsNewRelatedObjectsPublic] = useState(isSwitchingToPublic);

  const onConfirm = useCallback(async () => {
    await graphStore.setIsPublic({
      objectId,
      relationId,
      isPublic: isSwitchingToPublic,
      alsoSetRelatedObjects: includeRelatedObjects,
      alsoSetChildrenAndDescendants: includeChildrenAndDescendants,
      isNewRelatedObjectsPublic: isSwitchingToPublic ? isNewRelatedObjectsPublic : false,
    });
    setOpen(false);
  }, [
    graphStore,
    includeChildrenAndDescendants,
    includeRelatedObjects,
    isSwitchingToPublic,
    objectId,
    relationId,
    setOpen,
    isNewRelatedObjectsPublic,
  ]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.DialogOverlay} />
        <Dialog.Content className={styles.DialogContent}>
          <div className={styles.DialogHeader}>
            <Dialog.Title className={styles.DialogTitle}>
              {isSwitchingToPublic ? "Make Public" : "Make Private"}
            </Dialog.Title>
          </div>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" className={styles.DialogCloseButton} aria-label="close">
              <X size={16} />
            </Button>
          </Dialog.Close>
          <Dialog.Description className={styles.DialogDescription}>
            Change the public visibility of this object?
          </Dialog.Description>
          <label className={styles.LabelSetting}>
            <input
              type="checkbox"
              checked={includeRelatedObjects}
              onChange={(e) => setIncludeRelatedObjects(e.target.checked)}
            />
            Also set visibility for all related object (except parents)
          </label>
          <label className={styles.LabelSetting}>
            <input
              type="checkbox"
              checked={includeChildrenAndDescendants}
              onChange={(e) => setIncludeChildrenAndDescendants(e.target.checked)}
            />
            Also set visibility for all descendants
          </label>
          {isSwitchingToPublic && (
            <label className={styles.LabelSetting}>
              <input
                type="checkbox"
                checked={isNewRelatedObjectsPublic}
                onChange={(e) => setIsNewRelatedObjectsPublic(e.target.checked)}
              />
              Make related objects public by default
            </label>
          )}
          <div className={styles.DialogActions}>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onConfirm}>
              {isSwitchingToPublic ? "Make Public" : "Make Private"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
