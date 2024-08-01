"use client";
import { getDependencyTree, getObserverTree, toJS } from "mobx";
import Pusher from "pusher-js";
import { createContext, useContext, useEffect, useState } from "react";

import { MewUser, UNLOGGED_USER } from "@/app/auth/MewUser";
import { useAuth } from "@/app/auth/useAuth";
import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { GraphStoreProvider } from "@/app/graph/useGraphStore";
import { SettingsStoreProvider } from "@/app/graph/useSettingsStore";
import { fetchGetOrCreateUser, loadGraphData } from "@/app/persistence/loadGraphData";
import { RenderController } from "@/app/render/RenderController";
import { RenderControllerProvider } from "@/app/render/useRenderController";
import { SerializedSyncDataSchema } from "@/app/sync/SyncTask";
import { toast } from "@/app/util";
import { ViewStoreProvider } from "@/app/view/useViewStore";
import { ViewStore } from "@/app/view/ViewStore";
import appLogger from "@/lib/logger";
import { userIdToPusherChannel } from "@/lib/pusher";

export const logger = appLogger.child({ service: "store-provider" });

export function StoresProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(auth ? auth.isLoading : false);

  // instantiate empty stores with unlogged user
  const [user, setUser] = useState<MewUser>(UNLOGGED_USER);
  const [graphStore, setGraphStore] = useState<GraphStore>(new GraphStore(UNLOGGED_USER));
  const [settingsStore, setSettingsStore] = useState<SettingsStore>(new SettingsStore());
  const [viewStore, setViewStore] = useState<ViewStore>(new ViewStore(settingsStore, graphStore));
  const [renderController, setRenderController] = useState<RenderController>(new RenderController());
  // expose stores to window for debugging
  if (env.env !== "production" && typeof window !== "undefined") {
    window.mew = { env, toJS, graphStore, viewStore, renderController, getDependencyTree, getObserverTree };
  }

  // when auth changes, clean up current stores and setup up new ones
  useEffect(() => {
    async function setupStores() {
      if (!auth) return logger.debug("Skip store setup while auth is disabled");
      if (!auth.user) return logger.debug("Skip store setup while not authenticated");
      if (auth.isLoading) return logger.debug("Skip loading stores while auth is loading");

      logger.debug("Starting to setup stores", auth);
      setIsLoading(true);

      const authedFetch: typeof fetch = async (input, init) => {
        const token = await auth.getAccessTokenSilently();
        return fetch(input, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
      };

      // load user
      logger.debug("Loading user");
      let newUser: MewUser;
      try {
        const data = await fetchGetOrCreateUser(auth.user, authedFetch);
        if (!data) throw new Error("fetchGetOrCreateUser returned null");
        newUser = new MewUser({ ...data });
      } catch (e) {
        logger.error("Failed to get or create user, using unlogged user", e);
        newUser = UNLOGGED_USER;
      }

      // create new stores
      const graphStore = new GraphStore(newUser, authedFetch);
      const settingsStore = new SettingsStore();
      const viewStore = new ViewStore(settingsStore, graphStore);
      const renderController = new RenderController();

      // load and start sync
      let syncCleanup = () => {};
      try {
        if (env.isPersistenceEnabled && !newUser.isUnlogged) {
          logger.debug("Loading data", newUser.id);
          await loadGraphData(graphStore, viewStore, authedFetch);
          logger.debug("Starting sync");
          syncCleanup = startSync({ graphStore, authFetch: authedFetch });
        }
      } catch (e) {
        toast("Failed to load data from server. Starting with an empty graph.");
        logger.error("Failed sync setup", e);
      }

      // set stores
      setUser(newUser);
      setGraphStore(graphStore);
      setSettingsStore(settingsStore);
      setViewStore(viewStore);
      setRenderController(renderController);
      setIsLoading(false);

      return () => {
        logger.debug("Cleaning up stores");
        graphStore.cleanup();
        settingsStore.cleanup();
        viewStore.cleanup();
        renderController.cleanup();
        syncCleanup();
      };
    }

    const cleanupPromise = setupStores();
    return () => {
      cleanupPromise.then((cleanup) => {
        cleanup?.();
      });
    };
  }, [auth]);

  return (
    <LoadingContext.Provider value={isLoading}>
      <UserContext.Provider value={user}>
        <SettingsStoreProvider value={settingsStore}>
          <GraphStoreProvider value={graphStore}>
            <ViewStoreProvider value={viewStore}>
              <RenderControllerProvider value={renderController}>{children}</RenderControllerProvider>
            </ViewStoreProvider>
          </GraphStoreProvider>
        </SettingsStoreProvider>
      </UserContext.Provider>
    </LoadingContext.Provider>
  );
}

function startSync({ graphStore, authFetch }: { graphStore: GraphStore; authFetch: typeof fetch }) {
  const pusher = new Pusher(env.pusherKey, {
    cluster: env.pusherCluster,
  });
  const channel = pusher.subscribe(userIdToPusherChannel(graphStore.user.id));
  channel.bind("transaction-accepted", async (data: any) => {
    const parsed = SerializedSyncDataSchema.safeParse(data);
    if (!parsed.success) {
      console.error("Invalid sync data received", data);
      return;
    }
    await graphStore.handleSyncData(parsed.data);
  });
  const stopSyncing = graphStore.startSync();
  return () => {
    pusher.disconnect();
    stopSyncing();
  };
}

const LoadingContext = createContext(false);
const UserContext = createContext<MewUser>(UNLOGGED_USER);

export const useLoading = () => {
  return useContext(LoadingContext);
};

export const useUser = () => {
  return useContext(UserContext);
};
