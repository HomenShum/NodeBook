import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { ReactNode } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useViewStore } from "@/app/view/useViewStore";

import styles from "./DataDialog.module.css";

interface Props {
  title: string;
  description: string;
  children: ReactNode;
  modalType: "devTools" | "importData" | "clearData";
  showBackButton?: boolean;
  onBack?: () => void;
}

export const DataDialog = observer(function DataDialog({
  title,
  description,
  children,
  modalType,
  showBackButton,
  onBack,
}: Props) {
  const viewStore = useViewStore();

  const handleClose = () => {
    viewStore.setActiveModal(null);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      viewStore.setActiveModal("devTools");
    }
  };

  return (
    <Dialog.Root open={viewStore.activeModal === modalType} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.DialogOverlay} />
        <Dialog.Content className={styles.DialogContent}>
          <div className={styles.DialogHeader}>
            {showBackButton && (
              <Button variant="ghost" size="icon" className={styles.BackButton} onClick={handleBack}>
                <ArrowLeft size={16} />
              </Button>
            )}
            <Dialog.Title className={styles.DialogTitle}>{title}</Dialog.Title>
          </div>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" className={styles.DialogCloseButton} aria-label="close">
              <X size={16} />
            </Button>
          </Dialog.Close>
          <Dialog.Description className={styles.DialogDescription}>{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
