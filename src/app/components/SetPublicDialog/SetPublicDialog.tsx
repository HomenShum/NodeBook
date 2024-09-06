import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/graph/useGraphStore";

import styles from "./SetPublicDialog.module.css";

interface Props {
  isOpen: boolean;
  setOpen: (v: boolean) => void;
  objectId: string;
  relationId?: string;
  isPublic: boolean;
}

export const SetPublicDialog = observer(({ isOpen, setOpen, objectId, relationId, isPublic }: Props) => {
  const graphStore = useGraphStore();

  const [includeRelatedObjects, setIncludeRelatedObjects] = useState(true);
  const [includeChildrenAndDescendants, setIncludeChildrenAndDescendants] = useState(true);

  const onConfirm = useCallback(async () => {
    await graphStore.setIsPublic({
      objectId,
      relationId,
      isPublic,
      alsoSetRelatedObjects: includeRelatedObjects,
      alsoSetChildrenAndDescendants: includeChildrenAndDescendants,
    });
    setOpen(false);
  }, [graphStore, includeChildrenAndDescendants, includeRelatedObjects, isPublic, objectId, relationId, setOpen]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.DialogOverlay} />
        <Dialog.Content className={styles.DialogContent}>
          <div className={styles.DialogHeader}>
            <Dialog.Title className={styles.DialogTitle}>{isPublic ? "Make Public" : "Make Private"}</Dialog.Title>
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
          <div className={styles.DialogActions}>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onConfirm}>
              {isPublic ? "Make Public" : "Make Private"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
