import { observer } from "mobx-react-lite";

import { useAuth } from "@/app/auth/useAuth";
import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import { Button } from "@/app/components/UIPrimitives/Button";
import { env } from "@/app/envFrontend";
import { SearchAndReplaceDropdownOption } from "@/app/graph/SettingsStore";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useRenderController } from "@/app/render/useRenderController";
import { useUser } from "@/app/StoresProvider";

import styles from "./DevTools.module.css";

const SelectSearchAndReplaceDropdown = observer(() => {
  const settingsStore = useSettingsStore();

  const searchAndReplaceDropdownOptions: { label: string; value: SearchAndReplaceDropdownOption }[] = [
    { label: "Always", value: SearchAndReplaceDropdownOption.Always },
    { label: "After typing in a labelled relations or semicolon", value: SearchAndReplaceDropdownOption.LabelledOnly },
    { label: "After typing semicolon", value: SearchAndReplaceDropdownOption.SemicolonOnly },
  ];

  return (
    <select
      value={settingsStore.searchAndReplaceDropdown}
      onChange={(e) => settingsStore.setSearchAndReplaceDropdown(e.target.value as SearchAndReplaceDropdownOption)}
    >
      {searchAndReplaceDropdownOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

export const DevTools = observer(() => {
  const auth = useAuth();
  const user = useUser();
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
    <DataDialog title="Settings" description="" modalType="devTools">
      <div className={styles.SettingsGroup}>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.addAllNewNodesAsChildrenOfUserNode}
            onChange={(e) => settingsStore.setAddAllNewNodesAsChildrenOfUserNode(e.target.checked)}
          />
          Add all new nodes as children of user node
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
        <div className={styles.SearchReplaceContainer}>
          <label>Trigger search and replace dropdown:</label>
          <SelectSearchAndReplaceDropdown />
        </div>
        <hr style={{ border: ".5px solid var(--gray-6)" }} />
        <div style={{ display: "flex", gap: 12 }}>
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
        </div>

        <hr style={{ border: ".5px solid var(--gray-6)" }} />
        <p>
          <span>Email:</span> {user.email}
        </p>
        <p>
          <span>User ID:</span> {user.id}
        </p>
        {env.gitCommitSha && (
          <p>
            <span>Git commit SHA:</span> {env.gitCommitSha}
          </p>
        )}
        <Button
          size="default"
          variant="default"
          onClick={() => {
            settingsStore.resetToDefaults();
          }}
        >
          Reset user settings to default
        </Button>
        {auth && (
          <Button
            size="default"
            variant="default"
            onClick={() => {
              handleClose();
              auth.logout({ logoutParams: { returnTo: window.location.origin } });
            }}
          >
            Log out
          </Button>
        )}
      </div>
    </DataDialog>
  );
});
