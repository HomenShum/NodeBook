import { observer } from "mobx-react-lite";

import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useRenderController } from "@/app/render/useRenderController";

import styles from "./DataDialog.module.css";

interface Props {
  onConfirm: () => void;
}

export const ClearData = observer(({ onConfirm }: Props) => {
  const renderController = useRenderController();
  return (
    <DataDialog
      title="Clear Data"
      description="Are you sure you want to delete all existing graph data? This action cannot be undone."
      modalType="clearData"
      showBackButton
    >
      <div className={styles.DialogActions}>
        <Button variant="outline" size="sm" onClick={() => renderController.setActiveModal("devTools")}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          Confirm Delete
        </Button>
      </div>
    </DataDialog>
  );
});
