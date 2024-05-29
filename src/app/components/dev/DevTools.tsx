import { useViewController } from "@/app/controller/useViewController";
import { useGraphStore } from "@/app/model/useGraphStore";
import { useSettingsStore } from "@/app/model/useSettingsStore";
import { observer } from "mobx-react-lite";
import { ClearData } from "../DataDialog/ClearData";
import { ImportDialog } from "../DataDialog/ImportDialog";
import { Button } from "../ui/Button";

export const DevTools = observer(() => {
  const settingsStore = useSettingsStore();
  const graphStore = useGraphStore();
  const viewController = useViewController();

  const searchAndReplaceDropdownOptions: {
    label: string;
    value: typeof settingsStore.searchAndReplaceDropdown;
  }[] = [
    { label: "Only after labelled relations", value: "labelled-only" },
    { label: "All", value: "all" },
    { label: "None", value: "none" },
  ];
  return (
    <div className="p-2 mb-0 overflow-y-auto flex flex-col flex-initial">
      <h1 className="text-xl font-bold mb-2">Dev Tools</h1>
      <div className="flex flex-col gap-2">
        <label className="cursor-pointer">
          <input
            type="checkbox"
            checked={settingsStore.showNodeDetails}
            onChange={(e) => settingsStore.setShowNodeDetails(e.target.checked)}
            className="mr-2 mb-2"
          />
          Show node details in view
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.hideDirectParent}
            onChange={(e) => settingsStore.setHideDirectParent(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide relations to direct parent
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.hideAllRootParents}
            onChange={(e) => settingsStore.setHideAllRootParents(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide all root parents
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.hideAllParents}
            onChange={(e) => settingsStore.setHideAllParents(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide all parents
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.hideBackrelations}
            onChange={(e) => settingsStore.setHideBackrelations(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide backrelations
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.hideBundles}
            onChange={(e) => settingsStore.setHideBundles(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide bundles
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.hideZones}
            onChange={(e) => settingsStore.setHideZones(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide zones
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.showAtSignOnMention}
            onChange={(e) => settingsStore.setShowAtSignOnMention(e.target.checked)}
            className="mr-2 mb-2"
          />
          Show @ sign on mention
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.addAllOutlineDescendantsToThoughtstream}
            onChange={(e) => settingsStore.setAddAllOutlineDescendantsToThoughtstream(e.target.checked)}
            className="mr-2 mb-2"
          />
          Add all outline descendants to thoughtstream
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.addThoughtstreamDirectChildrenToOutline}
            onChange={(e) => settingsStore.setAddThoughtstreamDirectChildrenToOutline(e.target.checked)}
            className="mr-2 mb-2"
          />
          Add thoughtstream direct children to outline
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.addThoughtstreamNestedChildrenToThoughtstream}
            onChange={(e) => settingsStore.setAddThoughtstreamNestedChildrenToThoughtstream(e.target.checked)}
            className="mr-2 mb-2"
          />
          Add thoughtstream nested children as direct children of thoughtstream
        </label>
        <label>
          <input
            type="checkbox"
            checked={settingsStore.hideThoughtstreamBullets}
            onChange={(e) => settingsStore.setHideThoughtstreamBullets(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide bullets in thoughtstream view
        </label>
        <label>
          <input
            type="checkbox"
            checked={settingsStore.addStreamLabeledRelationsToMyLists}
            onChange={(e) => settingsStore.setAddStreamLabeledRelationsToMyLists(e.target.checked)}
            className="mr-2 mb-2"
          />
          Add stream labeled relations to My Lists
        </label>
        <label>
          <input
            type="checkbox"
            checked={settingsStore.allowShiftTabAboveViewRoot}
            onChange={(e) => settingsStore.setAllowShiftTabAboveViewRoot(e.target.checked)}
            className="mr-2 mb-2"
          />
          Allow shift tab above view root
        </label>
        <label>
          <input
            type="checkbox"
            checked={settingsStore.disableCycles}
            onChange={(e) => settingsStore.setDisableCycles(e.target.checked)}
            className="mr-2 mb-2"
          />
          Disable expanding cycles
        </label>
        <label>
          <input
            type="checkbox"
            checked={settingsStore.hideBulletBackgroundIfParentsOnly}
            onChange={(e) => settingsStore.setHideBulletBackgroundIfParentsOnly(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide bullet backgrounds if it contains only parents
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.removingNodeAsDirectChildOfThoughtstreamDeletesIt}
            onChange={(e) => settingsStore.setRemovingNodeAsDirectChildOfThoughtstreamDeletesIt(e.target.checked)}
            className="mr-2 mb-2"
          />
          On removing node as direct child of thoughtstream, delete the node everywhere
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.atSignTriggerToReplaceObject}
            onChange={(e) => settingsStore.setAtSignTriggerToReplaceObject(e.target.checked)}
            className="mr-2 mb-2"
          />
          Type @ in an empty editor to trigger search and replace for current object
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settingsStore.semicolonTriggerToReplaceObject}
            onChange={(e) => settingsStore.setSemicolonTriggerToReplaceObject(e.target.checked)}
            className="mr-2 mb-2"
          />
          Type ; in an empty editor to trigger search and replace for current object
        </label>
        <div className="flex gap-2">
          <label>Search and replace dropdown:</label>
          <select
            value={settingsStore.searchAndReplaceDropdown}
            onChange={(e) => settingsStore.setSearchAndReplaceDropdown(e.target.value as any)} // TODO "as any" bad
          >
            {searchAndReplaceDropdownOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <hr />
        <ImportDialog />
        <Button
          size={"sm"}
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
          }}
        />
        <hr />
        <Button
          size={"sm"}
          style={{ maxWidth: "fit-content" }}
          onClick={() => {
            settingsStore.resetToDefaults();
          }}
        >
          Reset user setttings to default
        </Button>
      </div>
    </div>
  );
});
