import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";

import { useAuth } from "@/app/auth/useAuth";
import { DataDialog } from "@/app/components/DataDialog/DataDialog";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSettingsStore } from "@/app/contexts/SettingsStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { env } from "@/app/envFrontend";
import { useToast } from "@/app/hooks/useToast";
import { ideapadSnapshotFromSerializedGraph } from "@/app/util";
import { useViewStore } from "@/app/view/useViewStore";
import {
  ParseWithAiLinkingOption,
  ParseWithAiLinkingOptionEnum,
  PasteLinksOption,
  PasteLinksOptionEnum,
  SearchAndReplaceDropdownOption,
  SearchAndReplaceDropdownOptionEnum,
} from "@/db/schema";
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

const SelectPastingLinksDropdown = observer(function SelectSearchAndReplaceDropdown() {
  const settingsStore = useSettingsStore();

  const pasteLinkOptions: { label: string; value: PasteLinksOption }[] = [
    { label: "Nothing", value: PasteLinksOptionEnum.enum.Nothing },
    {
      label: "Populate links as children",
      value: PasteLinksOptionEnum.enum.PopulateAsChildren,
    },
    {
      label: "Links as orphaned nodes & convert links to mentions",
      value: PasteLinksOptionEnum.enum.PopulateAsOrphanedNodes,
    },
  ];

  return (
    <select
      value={settingsStore.pasteLinksDropdown}
      onChange={(e) => settingsStore.setPasteLinksDropdown(e.target.value as PasteLinksOption)}
    >
      {pasteLinkOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

const ParseWithAiLinkingDropdown = observer(function ParseWithAiLinkingDropdown() {
  const settingsStore = useSettingsStore();

  const parseWithAiOptions: { label: string; value: ParseWithAiLinkingOption }[] = [
    { label: "None", value: ParseWithAiLinkingOptionEnum.enum.None },
    {
      label: "Link nodes parsed from text to each other",
      value: ParseWithAiLinkingOptionEnum.enum.LinkNodesInParse,
    },
    {
      label: "Link parsed nodes to anything in graph",
      value: ParseWithAiLinkingOptionEnum.enum.LinkNodesInGraph,
    },
  ];

  return (
    <select
      value={settingsStore.parseWithAiLinkingOption}
      onChange={(e) => settingsStore.setParseWithAiLinkingOption(e.target.value as ParseWithAiLinkingOption)}
    >
      {parseWithAiOptions.map((option) => (
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

  const handleExportToIdeapad = useCallback(() => {
    // Create snapshot format
    const graphData = graphStore.serialize();

    const snapshot = ideapadSnapshotFromSerializedGraph(graphData, user.id, graphStore);

    // Export as JSON
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ideapad_export.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [graphStore, user.id]);

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
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.showIdeapadLinkButton}
            onChange={(e) => settingsStore.setShowIdeapadLinkButton(e.target.checked)}
          />
          Show Ideapad Link Button
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.showExportSubtreeToIdeapad}
            onChange={(e) => settingsStore.setShowExportSubtreeToIdeapad(e.target.checked)}
          />
          Show Export Subtree to Ideapad
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.showGraphViewButton}
            onChange={(e) => settingsStore.setShowGraphViewButton(e.target.checked)}
          />
          Show Graph View Button (Scrappy Demo)
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.showBulletForEmptyNode}
            onChange={(e) => settingsStore.setShowBulletForEmptyNode(e.target.checked)}
          />
          Show bullets for empty nodes
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.showNotifications}
            onChange={(e) => settingsStore.setShowNotifications(e.target.checked)}
          />
          Show notifications
        </label>
        <div className={styles.DevToolsDropdownContainer}>
          <label>Trigger search and replace dropdown:</label>
          <SelectSearchAndReplaceDropdown />
        </div>
        <div className={styles.DevToolsDropdownContainer}>
          <label>Pasting links behaviour:</label>
          <SelectPastingLinksDropdown />
        </div>
        <div className={styles.DevToolsDropdownContainer}>
          <label>Parse with AI node linking:</label>
          <ParseWithAiLinkingDropdown />
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
          <Button size="default" variant="accent" onClick={handleExportToIdeapad}>
            Export to Ideapad
          </Button>
          <DeleteAllButton />
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

function DeleteAllButton() {
  const auth = useAuth();
  const graphStore = useGraphStore();
  const { addToast } = useToast();
  const [deleting, setDeleting] = useState(false);

  if (env.env === "production" || !auth) return null;
  return (
    <Button
      size="default"
      variant="destructive"
      disabled={deleting}
      onClick={async () => {
        if (!auth) return;
        setDeleting(true);
        try {
          const token = await auth.getAccessTokenSilently();
          const res = await fetch("/api/delete-all", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          let message = res.statusText;
          try {
            const json = await res.json();
            message = json.message || message;
          } catch (e) {
            // Ignore
          }
          if (!res.ok) throw new Error(`${res.status} - ${message}`);
          graphStore.cleanup();
          addToast({ title: "All data deleted" });
        } catch (err) {
          console.error(err);
          addToast({
            title: "Failed to delete data",
            description: err instanceof Error ? err.message : "Unknown error",
          });
        } finally {
          setDeleting(false);
        }
      }}
    >
      {deleting ? (
        <>
          <span className={styles.Spinner}>⟳</span>
          Deleting...
        </>
      ) : (
        "Clear all data"
      )}
    </Button>
  );
}
