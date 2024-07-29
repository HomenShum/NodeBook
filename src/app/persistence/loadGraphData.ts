import { User } from "@auth0/auth0-react";

import { PostUserResponseSchema } from "@/app/api/types";
import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SerializedGraphStoreSchema, SerializedStores } from "@/app/persistence/SerializedData";
import { ViewStore } from "@/app/view/ViewStore";
import { PersistedUser } from "@/db/schema";
import logger from "@/lib/logger";

const localLocalData = (graphStore: GraphStore, viewStore: ViewStore) => {
  logger.debug("Loading data from local storage");
  const dataString = localStorage.getItem("data");
  if (!dataString) return;
  const data = JSON.parse(dataString) as SerializedStores;

  if (data.graphStore) {
    graphStore.initializeAndLoad(graphStore.user, data.graphStore);
  }

  if (data.viewStore) {
    viewStore.deserializeInPlace(data.viewStore);
  }

  logger.debug(`Successfully loaded data from ${env.persistTo}`);
};

const loadRemoteData = async (graphStore: GraphStore, viewStore: ViewStore, authFetch: typeof fetch) => {
  logger.debug("Loading data from server");

  const syncData = await authFetch(`/api/sync?userId=${graphStore.user.id}`).then((res) => res.json());
  const parsed = SerializedGraphStoreSchema.safeParse(syncData.data);
  if (parsed.success) {
    graphStore.initializeAndLoad(graphStore.user, parsed.data);
    logger.debug("Graph data loaded");
  } else {
    logger.error("Failed to parse graph store data from server", parsed.error);
  }

  // Legacy loading of viewStore from /api/persist
  // TODO: We probably should just delete this?
  const json = await fetch("/api/persist").then((res) => res.json());
  const dataString = json.data;
  if (!dataString) return;

  const data = JSON.parse(dataString) as SerializedStores;
  if (data.viewStore) {
    viewStore.deserializeInPlace(data.viewStore);
  }
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
    logger.error("Invalid response", parsedResponse.error);
    return undefined;
  }
  if (parsedResponse.data.error) {
    logger.error("Error response", parsedResponse.data.message);
    return undefined;
  }
  return parsedResponse.data.data;
};
