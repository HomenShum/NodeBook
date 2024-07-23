import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";

import styles from "./DataDialog.module.css";

interface Props {
  onConfirm: () => void;
  disabled?: boolean;
}

export const ConfirmReplace = observer(({ onConfirm, disabled }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = useCallback(() => {
    onConfirm();
    setIsOpen(false);
  }, [onConfirm]);

  return (
    <>
      <Button
        disabled={disabled}
        variant="destructive"
        size="sm"
        style={{ maxWidth: "fit-content" }}
        onClick={() => setIsOpen(true)}
      >
        Replace existing data
      </Button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.DialogOverlay} />
          <Dialog.Content className={styles.DialogContent}>
            <Dialog.Title className={styles.DialogTitle}>Confirm data replace</Dialog.Title>
            <Dialog.Description className={styles.DialogDescription}>
              Really replace all existing graph data?
            </Dialog.Description>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className={styles.DialogCloseButton} aria-label="close">
                <X size={16} />
              </Button>
            </Dialog.Close>
            <div className={styles.DialogActions}>
              <Dialog.Close asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button onClick={handleConfirm} variant="destructive" size="sm">
                Replace data
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
});
