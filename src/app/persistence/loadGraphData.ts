import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SerializedStores } from "@/app/persistence/SerializedData";
import { ViewStore } from "@/app/view/ViewStore";

const localLocalData = (graphStore: GraphStore, viewStore: ViewStore) => {
  console.debug("Loading data from local storage");
  const dataString = localStorage.getItem("data");
  if (!dataString) return;
  const data = JSON.parse(dataString) as SerializedStores;

  if (data.graphStore) {
    graphStore.deserializeInPlace(data.graphStore);
  }

  if (data.viewStore) {
    viewStore.deserializeInPlace(data.viewStore);
  }

  console.debug(`Successfully loaded data from ${env.persistTo}`);
};

const loadRemoteData = async (graphStore: GraphStore, viewStore: ViewStore) => {
  console.debug("Loading data from server");

  const json = await fetch("/api/persist").then((res) => res.json());
  const dataString = json.data;
  if (!dataString) return;

  const data = JSON.parse(dataString) as SerializedStores;

  // Uncomment this to load graph data from legacy /persist endpoint
  // TODO: Remove this after finished with sync system clean up
  // if (data.graphStore) {
  //   graphStore.deserializeInPlace(data.graphStore);
  // }

  if (data.viewStore) {
    viewStore.deserializeInPlace(data.viewStore);
  }

  const syncData = await fetch("/api/sync").then((res) => res.json());
  await graphStore.deserializeInPlace(syncData.data);
};

export async function loadGraphData(graphStore: GraphStore, viewStore: ViewStore) {
  if (env.persistTo === "local") {
    localLocalData(graphStore, viewStore);
  } else if (env.persistTo === "server") {
    await loadRemoteData(graphStore, viewStore);
  }
}
