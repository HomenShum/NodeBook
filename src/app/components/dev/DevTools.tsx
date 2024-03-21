import { GraphStoreContext } from "@/app/store/graph";
import { ViewStoreContext } from "@/app/store/outline";
import { observer } from "mobx-react-lite";
import { useContext } from "react";
import { Button } from "../ui/button";

export const DevTools = observer(() => {
  const graphStore = useContext(GraphStoreContext);
  const viewStore = useContext(ViewStoreContext);

  return (
    <div className="p-2 mb-4 max-h-96 overflow-y-auto flex flex-col">
      <h1 className="text-xl font-bold mb-2">Dev Tools</h1>
      <div className="flex flex-col gap-2">
        <label className="cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={viewStore.showNodeDetails}
            onChange={(e) => viewStore.setShowNodeDetails(e.target.checked)}
            className="mr-2 mb-2"
          />
          Show node details in view
        </label>
        <div className="flex gap-2">
          <label>Relation view:</label>
          <select
            value={viewStore.outlineViewStore.relatedNodesViewType}
            onChange={(e) => viewStore.outlineViewStore.setRelatedNodesViewType(e.target.value as any)} // TODO "as any" bad
          >
            <option value="all">All related nodes only</option>
            <option value="pinned">Pinned and all nodes</option>
          </select>
        </div>
        <Button
          size={"sm"}
          variant={"destructive"}
          style={{ maxWidth: "fit-content" }}
          onClick={() => {
            if (!confirm("Really delete all data?")) {
              return;
            }
            graphStore.remote?.deleteAll();
          }}
        >
          Delete all remote data
        </Button>
      </div>
    </div>
  );
});
