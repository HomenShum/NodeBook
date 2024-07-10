import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SerializedStores } from "@/app/persistence/SerializedData";
import { ViewStore } from "@/app/view/ViewStore";

export async function loadGraphData(graphStore: GraphStore, viewStore: ViewStore) {
  let dataString: string | null = null;
  if (env.persistTo === "local") {
    console.debug("Loading data from local storage");
    dataString = localStorage.getItem("data");
  } else if (env.persistTo === "server") {
    console.debug("Loading data from server");
    const json = await fetch("/api/persist").then((res) => res.json());
    dataString = json.data;
  }
  if (!dataString) return;

  const data = JSON.parse(dataString) as SerializedStores;
  // if (data.graphStore) {
  //   graphStore.deserializeInPlace(data.graphStore);
  // }
  if (data.viewStore) {
    viewStore.deserializeInPlace(data.viewStore);
  }
  console.debug(`Successfully loaded data from ${env.persistTo}`);

  const syncData = await fetch("/api/sync").then((res) => res.json());
  await graphStore.deserializeInPlace(syncData.data);
}
