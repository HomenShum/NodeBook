import { User } from "@auth0/auth0-react";

import { PostUserResponseSchema } from "@/app/api/types";
import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SerializedStores } from "@/app/persistence/SerializedData";
import { ViewStore } from "@/app/view/ViewStore";
import { PersistedUser } from "@/db/schema";

const localLocalData = (graphStore: GraphStore, viewStore: ViewStore) => {
  console.debug("Loading data from local storage");
  const dataString = localStorage.getItem("data");
  if (!dataString) return;
  const data = JSON.parse(dataString) as SerializedStores;

  if (data.graphStore) {
    graphStore.initializeAndLoad(graphStore.user, data.graphStore);
  }

  if (data.viewStore) {
    viewStore.deserializeInPlace(data.viewStore);
  }

  console.debug(`Successfully loaded data from ${env.persistTo}`);
};

const loadRemoteData = async (graphStore: GraphStore, viewStore: ViewStore, authFetch: typeof fetch) => {
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

  const syncData = await authFetch(`/api/sync?userId=${graphStore.user.id}`).then((res) => res.json());
  await graphStore.initializeAndLoad(graphStore.user, syncData.data);
};

export async function loadGraphData(graphStore: GraphStore, viewStore: ViewStore, authFetch: typeof fetch) {
  if (env.persistTo === "local") {
    localLocalData(graphStore, viewStore);
  } else if (env.persistTo === "server") {
    await loadRemoteData(graphStore, viewStore, authFetch);
  }
}
export const fetchGetOrCreateUser = async (user: User, authFetch: typeof fetch): Promise<PersistedUser | undefined> => {
  if (!user?.sub) throw new TypeError("This function must be called with a User that has the `sub` property");
  const response = await authFetch("/api/user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user: {
        id: user.sub,
        email: user.email,
        name: user.name ?? user.nickname ?? "The Nameless One",
        picture: user.picture,
        createdAt: user.updated_at ?? new Date().toISOString(),
      },
    }),
  }).then((res) => res.json());
  const parsedResponse = PostUserResponseSchema.safeParse(response);
  if (!parsedResponse.success) {
    console.error("Invalid response", parsedResponse.error);
    return undefined;
  }
  if (parsedResponse.data.error) {
    console.error("Error response", parsedResponse.data.message);
    return undefined;
  }
  return parsedResponse.data.data;
};
