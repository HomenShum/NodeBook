import { observer } from "mobx-react-lite";
import { useCallback } from "react";

import { useAuth } from "@/app/auth/useAuth";
import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { env } from "@/app/envFrontend";
import { useViewStore } from "@/app/view/useViewStore";
import { SearchAndReplaceDropdownOption, SearchAndReplaceDropdownOptionEnum } from "@/db/schema";
import logger from "@/lib/logger";

import styles from "./DevTools.module.css";

const SelectSearchAndReplaceDropdown = observer(function SelectSearchAndReplaceDropdown() {
  const settingsStore = useSettingsStore();

  const searchAndReplaceDropdownOptions: { label: string; value: SearchAndReplaceDropdownOption }[] = [
    { label: "Always", value: SearchAndReplaceDropdownOptionEnum.enum.Always },
    {
      label: "After typing in a labelled relations or semicolon",
      value: SearchAndReplaceDropdownOptionEnum.enum.LabelledOnly,
    },
    { label: "After typing semicolon", value: SearchAndReplaceDropdownOptionEnum.enum.SemicolonOnly },
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

export const DevTools = observer(function DevTools() {
  const auth = useAuth();
  const user = useUser();
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();

  const handleClose = useCallback(() => {
    viewStore.setActiveModal(null);
  }, [viewStore]);

  const handleLogout = useCallback(() => {
    if (!auth) return;
    handleClose();
    auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }, [auth, handleClose]);

  const handleOpenImportData = useCallback(() => {
    viewStore.setActiveModal("importData");
  }, [viewStore]);

  const handleExportAsJson = useCallback(() => {
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
  }, [graphStore]);

  return (
    <DataDialog title="" description="" modalType="devTools">
      <div className={styles.SettingsGroup}>
        <h1>Settings</h1>
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
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.triggerRelationOnSingleColon}
            onChange={(e) => settingsStore.setTriggerRelationOnSingleColon(e.target.checked)}
          />
          Use single colon to trigger relation combobox
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.atHashtagReplacement}
            onChange={(e) => settingsStore.setAtHashtagReplacement(e.target.checked)}
          />
          Replace # with @# while typing
        </label>
        <div className={styles.SearchReplaceContainer}>
          <label>Trigger search and replace dropdown:</label>
          <SelectSearchAndReplaceDropdown />
        </div>
        {env.env !== "production" && (
          <>
            <h2>Dev tools</h2>
            <Button
              size="default"
              onClick={() => {
                throw new Error("This is a test error thrown from DevTools");
              }}
            >
              Throw Test Error
            </Button>
            <Button
              size="default"
              onClick={() => {
                logger.error("This is a test error logged from DevTools");
              }}
            >
              Log Test Error
            </Button>
          </>
        )}
        <hr className={styles.Divider} />
        <div className={styles.ButtonContainer}>
          <Button size="default" variant="default" onClick={handleOpenImportData}>
            Import Data
          </Button>
          <Button size="default" variant="accent" onClick={handleExportAsJson}>
            Export as JSON
          </Button>
          {env.env !== "production" && (
            <Button size="default" variant="destructive" onClick={() => viewStore.setActiveModal("clearData")}>
              Clear all data
            </Button>
          )}
        </div>

        <hr className={styles.Divider} />
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
        <Button size="default" variant="default" onClick={() => settingsStore.resetToDefaults()}>
          Reset user settings to default
        </Button>
        {auth && (
          <Button size="default" variant="default" onClick={handleLogout}>
            Log out
          </Button>
        )}
      </div>
    </DataDialog>
  );
});
