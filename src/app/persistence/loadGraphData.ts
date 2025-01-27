import { User } from "@auth0/auth0-react";

import { GetUserResponseSchema, PostUserResponseSchema } from "@/app/api/types";
import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SerializedGraphStoreSchema, SerializedStores } from "@/app/persistence/SerializedData";
import { PersistedUser } from "@/db/schema";
import logger from "@/lib/logger";
import { getAuthFetch } from "@/app/util";

export const localLocalData = (graphStore: GraphStore) => {
  logger.debug("Loading data from local storage");
  const dataString = localStorage.getItem("data");
  if (!dataString) return;
  const data = JSON.parse(dataString) as SerializedStores;

  if (data.graphStore) {
    graphStore.resetAndLoad(data.graphStore);
  }

  logger.debug(`Successfully loaded data from ${env.persistTo}`);
};

export class LayerManager {
  private static loadedIds = new Set<string>();
  //We load just 1 load, loading 2 layers for canonical can be expensive.
  //Take a look at this later.
  private static loadedIdsForCanonical = new Set<string>();
  private searchedText = new Map<string, boolean>();
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly graphStore: GraphStore;

  public clear() {
    LayerManager.loadedIds.clear();
    this.searchedText.clear();
    clearTimeout(this.debounceTimer || -1);
  }

  constructor(graphStore: GraphStore) {
    this.graphStore = graphStore;
  }

  loadWithText(text: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (text.length < 3 || this.searchedText.has(text)) return;
    this.debounceTimer = setTimeout(async () => {
      this.searchedText.set(text, true);
      const nodeIds = await this.fetchAndLoad(`/api/search?query=${text}`);
      this.loadCanonicalWithIds(nodeIds);
    }, 80);
  }

  async loadWithBFS(objectId: string): Promise<void> {
    //Todo: Debounce this too, maybe make a debounce method instead of
    //cloning debounce from above
    await this.fetchAndLoad(`/api/layer/bfs?objectId=${objectId}`);
  }

  //Todo: Maybe add another method for lazy loading since we try to load an object
  //on hover. But a user can hover around and it dispatches multiple api calls.

  public async loadWithIds(objectIds: string[], withReset = false) {
    const ids = objectIds
      .filter((id) => !LayerManager.loadedIds.has(id))
      .map((id) => (id === "home" ? this.graphStore.userRootId : id));
    if (ids.length <= 0) return;
    ids.forEach((id) => LayerManager.loadedIds.add(id));
    const url = `/api/layer?objectId=`.concat(ids.join("&objectId="));
    return this.fetchAndLoad(url, withReset);
  }

  public async loadCanonicalWithIds(objectIds: string[]) {
    const ids = objectIds
      .filter((id) => !LayerManager.loadedIdsForCanonical.has(id))
      .map((id) => (id === "home" ? this.graphStore.userRootId : id));
    if (ids.length <= 0) return;
    ids.forEach((id) => LayerManager.loadedIdsForCanonical.add(id));
    const url = `/api/layer/canonical?objectId=`.concat(ids.join("&objectId="));
    return this.fetchAndLoad(url);
  }

  public async loadRelationTypes() {
    const url = `/api/layer/relations`;
    return this.fetchAndLoad(url);
  }

  private async fetchAndLoad(url: string, withReset: boolean = false) {
    const authFetch = getAuthFetch();
    const syncData = await authFetch(url).then((res) => res.json());
    const parsed = SerializedGraphStoreSchema.safeParse(syncData.data);
    if (parsed.success) {
      withReset ? this.graphStore.resetAndLoad(parsed.data) : this.graphStore.load(parsed.data);
      logger.debug("Graph layer loaded");
      return Object.keys(parsed.data.nodesById);
    } else {
      logger.error("Failed to parse graph store data from server", parsed.error);
      return [];
    }
  }
}

export const fetchGetOrCreateUser = async (user: User, userFetch: typeof fetch): Promise<PersistedUser | undefined> => {
  if (!user?.sub) throw new TypeError("This function must be called with a User that has the `sub` property");
  const response = await userFetch("/api/user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user: {
        id: user.sub,
        email: user.email ?? "",
        username: user.preferred_username ?? "",
        name: user.name ?? user.nickname ?? "The Nameless One",
        picture: user.picture ?? "",
        createdAt: user.updated_at ?? new Date().toISOString(),
        settings: {},
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

export const fetchGetUser = async (userFetch: typeof fetch): Promise<PersistedUser | null> => {
  const response = await userFetch("/api/user").then((res) => res.json());
  const parsedResponse = GetUserResponseSchema.safeParse(response);
  if (!parsedResponse.success) {
    logger.error("Invalid response", parsedResponse.error);
    return null;
  }
  if (parsedResponse.data.error) {
    logger.error("Error response", parsedResponse.data.message);
    return null;
  }
  return parsedResponse.data.data;
};
