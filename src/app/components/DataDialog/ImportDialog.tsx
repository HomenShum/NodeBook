import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/graph/useGraphStore";

import { ConfirmReplace } from "./ConfirmReplace";

import styles from "./DataDialog.module.css";

export const ImportDialog = () => {
  const graphStore = useGraphStore();

  const fileInputRef = useRef(null);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  const onReplaceConfirm = useCallback(() => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileContent = event.target!.result;
      graphStore.deserializeInPlace(JSON.parse(fileContent as string));
      setOpen(false);
    };
    reader.readAsText(file);
  }, [graphStore, file]);

  const onAddToGraphClick = useCallback(() => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileContent = event.target!.result;
      graphStore.deserializeAndMerge(JSON.parse(fileContent as string));
      setOpen(false);
    };
    reader.readAsText(file);
  }, [file, graphStore]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="default" variant="default" style={{ maxWidth: "fit-content" }}>
          Import data
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.DialogOverlay} />
        <Dialog.Content className={styles.DialogContent}>
          <Dialog.Title className={styles.DialogTitle}>Import data</Dialog.Title>
          <Dialog.Description className={styles.DialogDescription}>Import data into Mew.</Dialog.Description>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" className={styles.DialogCloseButton} aria-label="close">
              <X size={12} />
            </Button>
          </Dialog.Close>
          <fieldset className={styles.FileFieldset}>
            <Button
              size={"sm"}
              style={{ maxWidth: "fit-content" }}
              variant={file ? "outline" : "default"}
              onClick={() => {
                (fileInputRef.current! as HTMLInputElement).click();
              }}
            >
              {file ? "Change file" : "Select file"}
            </Button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setFile(file);
              }}
            />
            {file && (
              <p className={styles.SelectedFileLabel}>
                Selected: {file.name}
                <button
                  onClick={() => {
                    setFile(null);
                    (fileInputRef.current! as HTMLInputElement).value = "";
                  }}
                >
                  X
                </button>
              </p>
            )}
          </fieldset>
          <div style={{ display: "flex", gap: 5, marginTop: 25, justifyContent: "flex-end" }}>
            <ConfirmReplace disabled={!file} onConfirm={onReplaceConfirm} />
            <Button
              disabled={!file}
              onClick={onAddToGraphClick}
              variant="default"
              size={"sm"}
              style={{ maxWidth: "fit-content" }}
            >
              Add to graph
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
