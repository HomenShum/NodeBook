import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SerializedStores } from "@/app/persistence/SerializedData";
import { ViewStore } from "@/app/view/ViewStore";

export async function loadGraphData(graphStore: GraphStore, viewStore: ViewStore) {
  let dataString: string | null = null;
  if (env.persistTo === "local") {
    dataString = localStorage.getItem("data");
  } else if (env.persistTo === "server") {
    try {
      const json = await fetch("/api/persist").then((res) => res.json());
      dataString = json.data;
    } catch (e) {
      console.error("Error loading data from server", e);
    }
  }
  if (!dataString) return;

  const data = JSON.parse(dataString) as SerializedStores;
  if (data.graphStore) {
    graphStore.deserializeInPlace(data.graphStore);
  }
  if (data.viewStore) {
    viewStore.deserializeInPlace(data.viewStore);
  }
}
