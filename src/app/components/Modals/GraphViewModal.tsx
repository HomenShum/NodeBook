import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Image from "next/image";

import { Button } from "@/app/components/UIPrimitives/Button";

import styles from "./GraphViewModal.module.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function GraphViewModal({ isOpen, onClose }: Props) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.DialogOverlay} />
        <Dialog.Content className={styles.DialogContent}>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" className={styles.CloseButton}>
              <X size={14} />
            </Button>
          </Dialog.Close>
          <div className={styles.ImageContainer}>
            <Image
              src="/mock_graph.jpg"
              alt="Graph View"
              fill
              style={{ objectFit: "contain" }}
              className={styles.GraphImage}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
