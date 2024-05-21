import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/app/components/ui/button";

import { useState } from "react";
import styles from "./DataDialog.module.css";

interface Props {
  onConfirm: () => void;
  disabled?: boolean;
}

export const ConfirmReplace = ({ disabled, onConfirm }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button disabled={!!disabled} variant="destructive" size={"sm"} style={{ maxWidth: "fit-content" }}>
          Replace existing data
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.DialogOverlay} />
        <Dialog.Content className={styles.DialogContent}>
          <Dialog.Title className={styles.DialogTitle}>Confirm data replace</Dialog.Title>
          <Dialog.Description className={styles.DialogDescription}>
            Really replace all existing graph data?
          </Dialog.Description>
          <Dialog.Close asChild>
            <button className={styles.DialogCloseButton} aria-label="close">
              X
            </button>
          </Dialog.Close>
          <div style={{ display: "flex", gap: 5, marginTop: 25, justifyContent: "flex-end" }}>
            <Dialog.Close asChild>
              <Button variant="outline" size={"sm"} style={{ maxWidth: "fit-content" }}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
              variant="destructive"
              size={"sm"}
              style={{ maxWidth: "fit-content" }}
            >
              Replace data
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
