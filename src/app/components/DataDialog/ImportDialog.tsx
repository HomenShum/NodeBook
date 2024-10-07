import { X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useRef, useState } from "react";

import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useViewStore } from "@/app/view/useViewStore";

import { ConfirmReplace } from "./ConfirmReplace";

import styles from "./DataDialog.module.css";

export const ImportDialog = observer(function ImportDialog() {
  const viewStore = useViewStore();

  const graphStore = useGraphStore();
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const onReplaceConfirm = useCallback(() => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileContent = event.target!.result;
      graphStore.resetAndLoad(JSON.parse(fileContent as string));
      viewStore.setActiveModal(null); // Close the ImportDialog after replacing data
    };
    reader.readAsText(file);
  }, [graphStore, file, viewStore]);

  const onAddToGraphClick = useCallback(() => {
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const fileContent = event.target!.result;
      graphStore.importData(JSON.parse(fileContent as string)).finally(() => {
        viewStore.setActiveModal(null);
        setIsLoading(false);
      });
    };
    reader.readAsText(file);
  }, [file, graphStore, viewStore, setIsLoading]);

  return (
    <DataDialog
      title="Import Data"
      description={isLoading ? "Loading your data..." : "Import your data."}
      modalType="importData"
      showBackButton
      onBack={() => viewStore.setActiveModal("devTools")}
    >
      <fieldset className={styles.FileFieldset}>
        <Button
          size="sm"
          className={styles.Button}
          variant={file ? "outline" : "default"}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? "Change file" : "Select file"}
        </Button>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          className={styles.InvisibleInput}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0] ?? null;
            setFile(selectedFile);
          }}
        />
        {file && (
          <p className={styles.SelectedFileLabel}>
            Selected: {file.name}
            <button
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              <X size={12} />
            </button>
          </p>
        )}
      </fieldset>
      <div className={styles.DialogActions}>
        <ConfirmReplace disabled={!file || isLoading} onConfirm={onReplaceConfirm} />
        <Button
          disabled={!file || isLoading}
          variant="default"
          size="sm"
          className={styles.Button}
          onClick={onAddToGraphClick}
        >
          {isLoading ? "Loading..." : "Add to graph"}
        </Button>
      </div>
    </DataDialog>
  );
});
