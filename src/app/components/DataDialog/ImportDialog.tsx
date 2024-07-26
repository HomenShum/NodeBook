import { X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useRef, useState } from "react";

import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useRenderController } from "@/app/render/useRenderController";
import { useUser } from "@/app/StoresProvider";

import { ConfirmReplace } from "./ConfirmReplace";

import styles from "./DataDialog.module.css";

export const ImportDialog = observer(() => {
  const user = useUser();
  const renderController = useRenderController();

  const graphStore = useGraphStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const onReplaceConfirm = useCallback(() => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileContent = event.target!.result;
      graphStore.initializeAndLoad(user, JSON.parse(fileContent as string));
      renderController.setActiveModal(null); // Close the ImportDialog after replacing data
    };
    reader.readAsText(file);
  }, [graphStore, file, user, renderController]);

  const onAddToGraphClick = useCallback(() => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileContent = event.target!.result;
      graphStore.load(JSON.parse(fileContent as string));
      renderController.setActiveModal(null);
    };
    reader.readAsText(file);
  }, [file, graphStore, renderController]);

  return (
    <DataDialog
      title="Import Data"
      description="Import your data."
      modalType="importData"
      showBackButton
      onBack={() => renderController.setActiveModal("devTools")}
    >
      <fieldset className={styles.FileFieldset}>
        <Button
          size="sm"
          style={{ maxWidth: "fit-content" }}
          variant={file ? "outline" : "default"}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? "Change file" : "Select file"}
        </Button>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: "none" }}
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
        <ConfirmReplace disabled={!file} onConfirm={onReplaceConfirm} />
        <Button
          disabled={!file}
          onClick={onAddToGraphClick}
          variant="default"
          size="sm"
          style={{ maxWidth: "fit-content" }}
        >
          Add to graph
        </Button>
      </div>
    </DataDialog>
  );
});
