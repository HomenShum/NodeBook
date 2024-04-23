import { useGraphStore } from "@/app/store/useGraphStore";
import { useViewStore } from "@/app/store/useViewStore";
import { observer } from "mobx-react-lite";
import { useRef } from "react";
import { Button } from "../ui/button";

export const DevTools = observer(() => {
  const graphStore = useGraphStore();
  const viewStore = useViewStore();
  const fileInputRef = useRef(null);

  return (
    <div className="p-2 mb-4 max-h-96 overflow-y-auto flex flex-col">
      <h1 className="text-xl font-bold mb-2">Dev Tools</h1>
      <div className="flex flex-col gap-2">
        <label className="cursor-pointer">
          <input
            type="checkbox"
            checked={viewStore.showNodeDetails}
            onChange={(e) => viewStore.setShowNodeDetails(e.target.checked)}
            className="mr-2 mb-2"
          />
          Show node details in view
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewStore.hideDirectParent}
            onChange={(e) => viewStore.setHideDirectParent(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide relations to direct parent
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewStore.hideAllRootParents}
            onChange={(e) => viewStore.setHideAllRootParents(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide all root parents
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewStore.hideAllParents}
            onChange={(e) => viewStore.setHideAllParents(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide all parents
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewStore.hideBackrelations}
            onChange={(e) => viewStore.setHideBackrelations(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide backrelations
        </label>
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewStore.hideBundles}
            onChange={(e) => viewStore.setHideBundles(e.target.checked)}
            className="mr-2 mb-2"
          />
          Hide bundles
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
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={graphStore.removingNodeAsDirectChildOfThoughtstreamDeletesIt}
            onChange={(e) => graphStore.setRemovingNodeAsDirectChildOfThoughtstreamDeletesIt(e.target.checked)}
            className="mr-2 mb-2"
          />
          On removing node as direct child of thoughtstream, delete the node everywhere
        </label>

        {/* <div className="flex gap-2">
          <label>Relation view:</label>
          <select
            value={viewStore.outlineViewStore.relatedNodesViewType}
            onChange={(e) => viewStore.outlineViewStore.setRelatedNodesViewType(e.target.value as any)} // TODO "as any" bad
          >
            <option value="all">All related nodes only</option>
            <option value="pinned">Pinned and all nodes</option>
          </select>
        </div> */}
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
        <Button
          size={"sm"}
          variant={"destructive"}
          style={{ maxWidth: "fit-content" }}
          onClick={() => {
            throw new Error("Not implemented");
            // if (!confirm("Really delete all data?")) {
            //   return;
            // }
            // graphStore.remote?.deleteAll();
          }}
        >
          Delete all remote data
        </Button>
      </div>
    </div>
  );
});
