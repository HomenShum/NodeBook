import { User } from "@auth0/auth0-react";
import { captureException } from "@sentry/nextjs";
import { action, makeObservable, observable } from "mobx";

import { GetUserResponseSchema, PostUserResponseSchema } from "@/app/api/types";
import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SerializedGraphStoreSchema, SerializedStores } from "@/app/persistence/SerializedData";
import { getAuthFetch } from "@/app/util";
import { PersistedUser } from "@/db/schema";
import logger from "@/lib/logger";
import canonicalPathCacheStore from "@/stores/CanonicalPathCacheStore";

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
  public loadedIds = new Set<string>();
  private lazyQueuedIds = new Set<string>();
  //We load just 1 layer, loading 2 layers for canonical can be expensive.
  //Hence a separate Set(). Take a look at this later.
  private static loadedIdsForCanonical = new Set<string>();
  private searchedText = new Map<string, boolean>();
  private searchDebounceTimer: NodeJS.Timeout | null = null;
  private lazyLoadTimer: NodeJS.Timeout | null = null;
  private readonly graphStore: GraphStore;
  private abortController: AbortController | null = null;
  private initialLoadComplete = false; // Track if initial load is done

  public clear() {
    this.loadedIds.clear();
    this.searchedText.clear();
    this.initialLoadComplete = false;
    clearTimeout(this.searchDebounceTimer || -1);
    clearTimeout(this.lazyLoadTimer || -1);
  }

  constructor(graphStore: GraphStore) {
    this.graphStore = graphStore;
    makeObservable(this, {
      loadedIds: observable,
      clear: action,
      loadWithIds: action,
      initialize: action,
      lazyLoadWithIds: action
    })
  }

  /**
   * Load initial essential user objects with their first levels.
   * This should be called once when the app starts up.
   */
  async loadInitial(): Promise<void> {
    if (this.initialLoadComplete) return;

    try {
      await this.fetchAndLoad(`/api/layer/initial`);
      this.initialLoadComplete = true;
    } catch (e) {
      logger.error("Failed to load initial layers", e);
    }
  }

  loadWithText(text: string): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      if (this.abortController) {
        this.abortController.abort(`received new search query ${text}`);
      }
      this.abortController = new AbortController();
    }
    if (!text || text.length < 3 || this.searchedText.has(text)) return;
    this.searchDebounceTimer = setTimeout(async () => {
      try {
        this.graphStore.updateInFlightSearchCount("increment");
        this.searchedText.set(text, true);
        // Search only loads specific nodes without layers for performance
        const nodeIds = await this.fetchAndLoad(`/api/search?query=${encodeURIComponent(text)}`, {
          signal: this.abortController?.signal,
        });
        // We don't need canonical loading for search results as they're just nodes
        this.graphStore.incrementSearchTrigger();
      } catch (e) {
        this.searchedText.delete(text);
        if (e instanceof DOMException && e.name === "AbortError") {
          logger.debug("Search aborted");
        } else {
          captureException(e, {
            extra: { text, message: "Search failed" },
          });
        }
      } finally {
        this.graphStore.updateInFlightSearchCount("decrement");
      }
    }, 150);
  }

  async loadWithBFS(objectId: string): Promise<void> {
    //Todo: Debounce this too, maybe make a debounce method instead of
    //cloning debounce from above
    await this.fetchAndLoad(`/api/layer/bfs?objectId=${objectId}`);
  }

  public async loadWithIds(objectIds: string[], withReset = false, forceIds: string[] = []) {
    const ids = objectIds
      .filter((id) => !this.loadedIds.has(id) || forceIds.includes(id))
      .map((id) => (id === "home" ? this.graphStore.userRootId : id));
    if (ids.length <= 0) return;
    ids.forEach((id) => {
      this.loadedIds.add(id);
      this.graphStore.setNodeLayerLoadingStatus(id, true);
    });
    const loadedIds = await this.fetchAndLoad(
      `/api/layer`,
      {
        method: "POST",
        body: JSON.stringify({
          objectIds: ids,
        }),
      },
      withReset,
    );
    ids.forEach((id) => {
      this.graphStore.setNodeLayerLoadingStatus(id, false);
    });
    return loadedIds;
  }

  public async lazyLoadWithIds(objectIds: string[]) {
    if (this.lazyLoadTimer) {
      clearTimeout(this.lazyLoadTimer);
    }
    objectIds.forEach((id) => !this.loadedIds.has(id) && this.lazyQueuedIds.add(id));
    if (this.lazyQueuedIds.size <= 0) return;
    this.lazyLoadTimer = setTimeout(() => {
      this.loadWithIds(Array.from(this.lazyQueuedIds));
      this.lazyQueuedIds.clear();
    }, 400);
  }

  public async loadCanonicalWithIds(objectIds: string[], reload = false, init: RequestInit = {}) {
    const ids = objectIds
      .filter((id) => (reload ? true : !LayerManager.loadedIdsForCanonical.has(id)))
      .map((id) => (id === "home" ? this.graphStore.userRootId : id));
    if (ids.length <= 0) return;
    ids.forEach((id) => LayerManager.loadedIdsForCanonical.add(id));
    canonicalPathCacheStore.load(objectIds);
    return this.fetchAndLoad(`/api/layer/canonical`, {
      ...init,
      method: "POST",
      body: JSON.stringify({
        objectIds: ids,
      }),
    });
  }

  //Todo: I don't like this method and this class can be improved.
  // Maybe at some point, use server side rendering.
  // Adding this so we can do load the first layer and relation types in parallel
  public async initialize(objectIds: string[]): Promise<void> {
    if (!env.isPersistenceEnabled || env.persistTo !== "server") return;
    const authFetch = getAuthFetch();
    const ids = objectIds
      .filter((id) => !this.loadedIds.has(id))
      .map((id) => (id === "home" ? this.graphStore.userRootId : id));
    if (ids.length <= 0) return;
    ids.forEach((id) => this.loadedIds.add(id));
    const layers = await Promise.all([
      authFetch(`/api/layer`, {
        method: "POST",
        body: JSON.stringify({
          objectIds: ids,
        }),
      }).then((res) => res.json()),
      authFetch(`/api/layer/relations`).then((res) => res.json()),
    ]);
    let parsed = SerializedGraphStoreSchema.safeParse(layers[0].data);
    if (parsed.success) {
      this.graphStore.resetAndLoad(parsed.data);
    }
    parsed = SerializedGraphStoreSchema.safeParse(layers[1].data);
    if (parsed.success) {
      this.graphStore.load(parsed.data);
    }
  }

  public async loadRelationTypes() {
    const url = `/api/layer/relations`;
    return this.fetchAndLoad(url);
  }

  /**
   * Fetches and loads graph store data from the server IF persistence is enabled.
   *
   * @param url - The endpoint URL to fetch data from.
   * @param init - Fetch request options.
   * @param withReset - Whether to reset the graph store before loading the data.
   * @returns A promise that resolves to an array of node IDs successfully loaded i the graph store, or an empty array if fetching or parsing fails.
   */
  private async fetchAndLoad(url: string, init: RequestInit = {}, withReset: boolean = false): Promise<string[]> {
    if (!env.isPersistenceEnabled || env.persistTo !== "server") return [];
    const authFetch = getAuthFetch();
    const response = await authFetch(url, init);
    if (!response.ok) return [];
    const syncData = await response.json();
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
