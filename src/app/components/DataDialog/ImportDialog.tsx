import { X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useRef, useState } from "react";

import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import { ImportReviewList } from "@/app/components/DataDialog/ImportReviewList";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { SerializedGraphStore, SerializedGraphStoreSchema } from "@/app/persistence/SerializedData";
import { useViewStore } from "@/app/view/useViewStore";
import appLogger from "@/lib/logger";
import { parsePlainTextUpload } from "@/lib/plainTextParse";

import styles from "./DataDialog.module.css";

const logger = appLogger.child({ service: "ImportDialog" });

export const ImportDialog = observer(function ImportDialog() {
  const user = useUser();
  const viewStore = useViewStore();

  const graphStore = useGraphStore();
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [serializedGraphStore, setSerializedGraphStore] = useState<SerializedGraphStore | null>(null);

  const onSelectFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) return;
      const selectedFile = event.target.files?.[0] ?? null;
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fileContent = event.target?.result;
          if (typeof fileContent !== "string") {
            throw new Error("Unexpected file content type");
          }
          try {
            // We could attempt some clever stuff here to check if the file is JSON etc but easier to just try and parse it
            // as a SerializedGraphStore and see if it throws an error.
            const serializedGraphStore = SerializedGraphStoreSchema.parse(JSON.parse(fileContent));
            setSerializedGraphStore(serializedGraphStore);
            logger.info("Successfully parsed serialized graph store");
          } catch (error) {
            if (selectedFile?.name.endsWith(".json")) {
              throw error;
            }
            // If parsing as a SerializedGraphStore fails, we'll assume it's in the plain text upload format and try to handle that.
            const parsedGraphStore = parsePlainTextUpload(graphStore, fileContent);
            setSerializedGraphStore(parsedGraphStore);
            logger.info("Successfully parsed graph store from plain text upload");
          }
        } catch (error) {
          logger.error("Failed to parse file upload store", { error });
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          setFile(null);
          setSerializedGraphStore(null);
          alert("Invalid file format.");
        }
      };
      reader.readAsText(selectedFile);
    },
    [graphStore],
  );

  const onAddToGraphClick = useCallback(() => {
    if (!serializedGraphStore) return;
    setIsLoading(true);
    graphStore.importData(serializedGraphStore).finally(() => {
      viewStore.setActiveModal(null);
      setIsLoading(false);
    });
  }, [graphStore, viewStore, setIsLoading, serializedGraphStore]);

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
          accept=".json,.txt"
          ref={fileInputRef}
          className={styles.InvisibleInput}
          onChange={onSelectFile}
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
                setSerializedGraphStore(null);
              }}
            >
              <X size={12} />
            </button>
          </p>
        )}
      </fieldset>
      {serializedGraphStore &&
      (Object.keys(serializedGraphStore.nodesById).length > 0 ||
        Object.keys(serializedGraphStore.relationsById).length > 0 ||
        Object.keys(serializedGraphStore.relationTypesById).length > 0) ? (
        <ImportReviewList existingData={graphStore.serialize()} newData={serializedGraphStore} />
      ) : (
        <p>No new objects to import.</p>
      )}
      <div className={styles.DialogActions}>
        <Button
          disabled={
            !serializedGraphStore ||
            (Object.keys(serializedGraphStore.nodesById).length === 0 &&
              Object.keys(serializedGraphStore.relationsById).length === 0 &&
              Object.keys(serializedGraphStore.relationTypesById).length === 0)
          }
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
