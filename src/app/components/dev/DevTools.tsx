import { useViewController } from "@/app/controller/useViewController";
import { useGraphStore } from "@/app/store/useGraphStore";
import { observer } from "mobx-react-lite";
import { useRef } from "react";
import { Button } from "../ui/button";

export const DevTools = observer(() => {
  const graphStore = useGraphStore();
  const viewController = useViewController();
  const fileInputRef = useRef(null);

  const searchAndReplaceDropdownOptions: {
    label: string;
    value: typeof viewController.searchAndReplaceDropdown;
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
            checked={viewController.showNodeDetails}
            onChange={(e) => viewController.setShowNodeDetails(e.target.checked)}
            className="mr-2 mb-2"
          />
          Show node details in view
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewController.hideDirectParent}
            onChange={(e) => viewController.setHideDirectParent(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide relations to direct parent
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewController.hideAllRootParents}
            onChange={(e) => viewController.setHideAllRootParents(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide all root parents
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewController.hideAllParents}
            onChange={(e) => viewController.setHideAllParents(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide all parents
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewController.hideBackrelations}
            onChange={(e) => viewController.setHideBackrelations(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide backrelations
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewController.hideBundles}
            onChange={(e) => viewController.setHideBundles(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide bundles
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewController.hideZones}
            onChange={(e) => viewController.setHideZones(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide zones
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewController.showAtSignOnMention}
            onChange={(e) => viewController.setShowAtSignOnMention(e.target.checked)}
            className="mr-2 mb-2"
          />
          Show @ sign on mention
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={graphStore.addAllOutlineDescendantsToThoughtstream}
            onChange={(e) => graphStore.setAddAllOutlineDescendantsToThoughtstream(e.target.checked)}
            className="mr-2 mb-2"
          />
          Add all outline descendants to thoughtstream
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={graphStore.addThoughstreamDirectChildrenToOutline}
            onChange={(e) => graphStore.setAddThoughtstreamDirectChildrenToOutline(e.target.checked)}
            className="mr-2 mb-2"
          />
          Add thoughtstream direct children to outline
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={graphStore.addThoughtstreamNestedChildrenToThoughtstream}
            onChange={(e) => graphStore.setAddThoughtstreamNestedChildrenToThoughstream(e.target.checked)}
            className="mr-2 mb-2"
          />
          Add thoughtstream nested children as direct children of thoughtstream
        </label>
        <label>
          <input
            type="checkbox"
            checked={viewController.hideThoughtstreamBullets}
            onChange={(e) => viewController.setHideThoughtstreamBullets(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide bullets in thoughtstream view
        </label>
        <label>
          <input
            type="checkbox"
            checked={viewController.addStreamLabeledRelationsToMyLists}
            onChange={(e) => viewController.setAddStreamLabeledRelationsToMyLists(e.target.checked)}
            className="mr-2 mb-2"
          />
          Add stream labeled relations to My Lists
        </label>
        <label>
          <input
            type="checkbox"
            checked={viewController.allowShiftTabAboveViewRoot}
            onChange={(e) => viewController.setAllowShiftTabAboveViewRoot(e.target.checked)}
            className="mr-2 mb-2"
          />
          Allow shift tab above view root
        </label>
        <label>
          <input
            type="checkbox"
            checked={viewController.disableCycles}
            onChange={(e) => viewController.setDisableCycles(e.target.checked)}
            className="mr-2 mb-2"
          />
          Disable expanding cycles
        </label>
        <label>
          <input
            type="checkbox"
            checked={viewController.hideBulletBackgroundIfParentsOnly}
            onChange={(e) => viewController.setHideBulletBackgroundIfParentsOnly(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide bullet backgrounds if it contains only parents
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={graphStore.removingNodeAsDirectChildOfThoughtstreamDeletesIt}
            onChange={(e) => graphStore.setRemovingNodeAsDirectChildOfThoughtstreamDeletesIt(e.target.checked)}
            className="mr-2 mb-2"
          />
          On removing node as direct child of thoughtstream, delete the node everywhere
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewController.atSignTriggerToReplaceObject}
            onChange={(e) => viewController.setAtSignTriggerToReplaceObject(e.target.checked)}
            className="mr-2 mb-2"
          />
          Enable @ sign to trigger replacing current object
        </label>
        <div className="flex gap-2">
          <label>Search and replace dropdown:</label>
          <select
            value={viewController.searchAndReplaceDropdown}
            onChange={(e) => viewController.setSearchAndReplaceDropdown(e.target.value as any)} // TODO "as any" bad
          >
            {searchAndReplaceDropdownOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
        <Button
          size={"sm"}
          style={{ maxWidth: "fit-content" }}
          onClick={() => {
            (fileInputRef.current! as HTMLInputElement).click();
          }}
        >
          Import JSON
        </Button>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files![0];
            const reader = new FileReader();

            reader.onload = (event) => {
              const fileContent = event.target!.result;
              graphStore.deserializeInPlace(JSON.parse(fileContent as string));
            };

            reader.readAsText(file);
          }}
        />
      </div>
    </div>
  );
});
