import { observer } from "mobx-react-lite";

import { useAuth } from "@/app/auth/useAuth";
import { ClearData } from "@/app/components/DataDialog/ClearData";
import { ImportDialog } from "@/app/components/DataDialog/ImportDialog";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/graph/useGraphStore";
import { useSettingsStore } from "@/app/graph/useSettingsStore";
import { useViewStore } from "@/app/view/useViewStore";

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
  const { logout } = useAuth();
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const viewStore = useViewStore();

  return (
    <div className={styles.DevToolsContainer}>
      <h1 className={styles.DevToolsHeader}>Dev Tools</h1>
      <div className={styles.SettingsGroup}>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.showNodeDetails}
            onChange={(e) => settingsStore.setShowNodeDetails(e.target.checked)}
          />
          Show node details in view
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.hideDirectParent}
            onChange={(e) => settingsStore.setHideDirectParent(e.target.checked)}
          />
          Hide relations to direct parent
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.hideAllRootParents}
            onChange={(e) => settingsStore.setHideAllRootParents(e.target.checked)}
          />
          Hide all root parents
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.hideAllParents}
            onChange={(e) => settingsStore.setHideAllParents(e.target.checked)}
          />
          Hide all parents
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.hideBackrelations}
            onChange={(e) => settingsStore.setHideBackrelations(e.target.checked)}
          />
          Hide backrelations
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.hideBundles}
            onChange={(e) => settingsStore.setHideBundles(e.target.checked)}
          />
          Hide bundles
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.hideZones}
            onChange={(e) => settingsStore.setHideZones(e.target.checked)}
          />
          Hide zones
        </label>
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.showAtSignOnMention}
            onChange={(e) => settingsStore.setShowAtSignOnMention(e.target.checked)}
          />
          Show @ sign on mention
        </label>
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
            checked={settingsStore.hideThoughtstreamBullets}
            onChange={(e) => settingsStore.setHideThoughtstreamBullets(e.target.checked)}
          />
          Hide bullets in thoughtstream view
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
            checked={settingsStore.hideBulletBackgroundIfParentsOnly}
            onChange={(e) => settingsStore.setHideBulletBackgroundIfParentsOnly(e.target.checked)}
          />
          Hide bullet backgrounds if it contains only parents
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
        <label className={styles.LabelSetting}>
          <input
            type="checkbox"
            checked={settingsStore.hidePinnedItems}
            onChange={(e) => settingsStore.setHidePinnedItems(e.target.checked)}
          />
          Hide pinned items from the main list
        </label>
        <div className={styles.SearchReplaceContainer}>
          <label>Search and replace dropdown:</label>
          <SelectSearchAndReplaceDropdown />
        </div>
        <hr />
        <ImportDialog />
        <Button
          size="default"
          variant="accent"
          style={{ maxWidth: "fit-content" }}
          onClick={() => {
            // Create a Blob with the JSON string
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
        <ClearData
          onConfirm={() => {
            graphStore.clear();
            viewStore.clear();
          }}
        />
        <hr />
        <Button
          size="default"
          variant="default"
          style={{ maxWidth: "fit-content" }}
          onClick={() => {
            settingsStore.resetToDefaults();
          }}
        >
          Reset user setttings to default
        </Button>
        <Button
          size="default"
          variant="default"
          style={{ maxWidth: "fit-content" }}
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Log out
        </Button>
      </div>
    </div>
  );
});
