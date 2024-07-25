import { observer } from "mobx-react-lite";

import { useAuth } from "@/app/auth/useAuth";
import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useRenderController } from "@/app/render/useRenderController";

import styles from "./DevTools.module.css";

function SelectSearchAndReplaceDropdown() {
  const settingsStore = useSettingsStore();

  const searchAndReplaceDropdownOptions: { label: string; value: typeof settingsStore.searchAndReplaceDropdown }[] = [
    { label: "Only after labelled relations", value: "labelled-only" },
    { label: "All", value: "all" },
    { label: "None", value: "none" },
  ];

  return (
    <select
      value={settingsStore.searchAndReplaceDropdown}
      onChange={(e) =>
        settingsStore.setSearchAndReplaceDropdown(e.target.value as typeof settingsStore.searchAndReplaceDropdown)
      }
    >
      {searchAndReplaceDropdownOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export const DevTools = observer(() => {
  const { logout, user } = useAuth();
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const renderController = useRenderController();

  const handleClose = () => {
    renderController.setActiveModal(null);
  };

  const handleOpenImportData = () => {
    renderController.setActiveModal("importData");
  };

  return (
    <DataDialog title="Dev Tools" description="Manage App settings" modalType="devTools">
      <div className={styles.SettingsGroup}>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.addAllOutlineDescendantsToThoughtstream}
            onChange={(e) => settingsStore.setAddAllOutlineDescendantsToThoughtstream(e.target.checked)}
          />
          Add all outline descendants to thoughtstream
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.addThoughtstreamDirectChildrenToOutline}
            onChange={(e) => settingsStore.setAddThoughtstreamDirectChildrenToOutline(e.target.checked)}
          />
          Add thoughtstream direct children to outline
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.addThoughtstreamNestedChildrenToThoughtstream}
            onChange={(e) => settingsStore.setAddThoughtstreamNestedChildrenToThoughtstream(e.target.checked)}
          />
          Add thoughtstream nested children as direct children of thoughtstream
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.addStreamLabeledRelationsToMyLists}
            onChange={(e) => settingsStore.setAddStreamLabeledRelationsToMyLists(e.target.checked)}
          />
          Add stream labeled relations to My Lists
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.allowShiftTabAboveViewRoot}
            onChange={(e) => settingsStore.setAllowShiftTabAboveViewRoot(e.target.checked)}
          />
          Allow shift tab above view root
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.disableCycles}
            onChange={(e) => settingsStore.setDisableCycles(e.target.checked)}
          />
          Disable expanding cycles
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.removingNodeAsDirectChildOfThoughtstreamDeletesIt}
            onChange={(e) => settingsStore.setRemovingNodeAsDirectChildOfThoughtstreamDeletesIt(e.target.checked)}
          />
          On removing node as direct child of thoughtstream, delete the node everywhere
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.atSignTriggerToReplaceObject}
            onChange={(e) => settingsStore.setAtSignTriggerToReplaceObject(e.target.checked)}
          />
          Type @ in an empty editor to trigger search and replace for current object
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.semicolonTriggerToReplaceObject}
            onChange={(e) => settingsStore.setSemicolonTriggerToReplaceObject(e.target.checked)}
          />
          Type ; in an empty editor to trigger search and replace for current object
        </label>
        <div className={styles.SearchReplaceContainer}>
          <label>Search and replace dropdown:</label>
          <SelectSearchAndReplaceDropdown />
        </div>
        <hr />
        <Button size="default" variant="default" onClick={handleOpenImportData}>
          Import Data
        </Button>
        <Button
          size="default"
          variant="accent"
          onClick={() => {
            // Export as JSON logic
            const blob = new Blob([JSON.stringify(graphStore.serialize())], { type: "application/json" });
            // Create a temporary URL for the Blob
            const url = URL.createObjectURL(blob);
            // Create a link element and trigger the download
            const link = document.createElement("a");
            link.href = url;
            link.download = "data.json";
            link.click();
            // Clean up the temporary URL
            URL.revokeObjectURL(url);
          }}
        >
          Export as JSON
        </Button>
        <Button size="default" variant="destructive" onClick={() => renderController.setActiveModal("clearData")}>
          Clear all data
        </Button>
        <hr />
        <Button
          size="default"
          variant="default"
          onClick={() => {
            settingsStore.resetToDefaults();
          }}
        >
          Reset user settings to default
        </Button>
        {!user.isUnlogged && (
          <Button
            size="default"
            variant="default"
            onClick={() => {
              handleClose();
              logout({ logoutParams: { returnTo: window.location.origin } });
            }}
          >
            Log out
          </Button>
        )}
      </div>
    </DataDialog>
  );
});
