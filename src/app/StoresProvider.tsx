"use client";
import { getDependencyTree, getObserverTree, toJS } from "mobx";
import Pusher from "pusher-js";
import React, { createContext, useContext, useEffect, useState } from "react";

import { MewUser, UNLOGGED_USER } from "@/app/auth/MewUser";
import { useAuth } from "@/app/auth/useAuth";
import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { SyncDataSchema } from "@/app/graph/SyncData";
import { GraphStoreProvider } from "@/app/graph/useGraphStore";
import { SettingsStoreProvider } from "@/app/graph/useSettingsStore";
import { fetchGetOrCreateUser, loadGraphData } from "@/app/persistence/loadGraphData";
import { toast } from "@/app/util";
import { ViewStoreProvider } from "@/app/view/useViewStore";
import { ViewStore } from "@/app/view/ViewStore";
import rootLogger from "@/lib/logger";
import { GLOBAL_GRAPH_CHANNEL, userIdToPusherChannel } from "@/lib/pusher";

export const logger = rootLogger.child({ service: "store-provider" });

export function StoresProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(auth ? auth.isLoading : false);

  // instantiate empty stores with unlogged user
  const [user, setUser] = useState<MewUser>(UNLOGGED_USER);
  const [settingsStore, setSettingsStore] = useState<SettingsStore>(new SettingsStore());
  const [graphStore, setGraphStore] = useState<GraphStore>(new GraphStore(UNLOGGED_USER, settingsStore));
  const [viewStore, setViewStore] = useState<ViewStore>(new ViewStore(settingsStore, graphStore));
  // expose stores to window for debugging
  if (env.env !== "production" && typeof window !== "undefined") {
    window.mew = {
      env,
      toJS,
      graphStore,
      viewStore,
      getDependencyTree,
      getObserverTree,
      rootLogger,
    };
  }

  // when auth changes, clean up current stores and setup up new ones
  useEffect(() => {
    let ignore = false;
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

      // create new stores (shorter names to distinguish from the state variables)
      const settings = new SettingsStore();
      const graph = new GraphStore(newUser, settings, authedFetch);
      const view = new ViewStore(settings, graph);

      // load and start sync
      let syncCleanup = () => {};
      try {
        if (env.isPersistenceEnabled && !newUser.isUnlogged) {
          logger.debug("Loading data", newUser.id);
          await loadGraphData(graph, authedFetch);
        }
      } catch (e) {
        toast("Failed to load data from server. Starting with an empty graph.");
        logger.error("Failed sync setup", e);
      }

      // Set up stores. (unless we are unmounting, in which case ignore the result)
      if (ignore) return;
      logger.debug("Starting sync");
      syncCleanup = startSync({ graphStore: graph });
      setUser(newUser);
      setGraphStore(graph);
      setSettingsStore(settings);
      setViewStore(view);
      setIsLoading(false);
      return () => {
        logger.debug("Cleaning up stores");
        graph.cleanup();
        settings.cleanup();
        view.cleanup();
        syncCleanup();
      };
    }

    const cleanupPromise = setupStores();
    return () => {
      ignore = true;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [auth]);

  return (
    <LoadingContext.Provider value={isLoading}>
      <UserContext.Provider value={user}>
        <SettingsStoreProvider value={settingsStore}>
          <GraphStoreProvider value={graphStore}>
            <ViewStoreProvider value={viewStore}>{children}</ViewStoreProvider>
          </GraphStoreProvider>
        </SettingsStoreProvider>
      </UserContext.Provider>
    </LoadingContext.Provider>
  );
}

function startSync({ graphStore }: { graphStore: GraphStore }) {
  const pusher = new Pusher(env.pusherKey, {
    cluster: env.pusherCluster,
  });
  const handlePusherMessage = async (data: any, resetIfApplyFails: boolean) => {
    const parsedSyncData = SyncDataSchema.safeParse(data);
    if (!parsedSyncData.success) {
      console.error("Invalid sync data received", data);
      return;
    }
    await graphStore.updateManager.handleSyncData(parsedSyncData.data, resetIfApplyFails);
  };
  const userChannel = pusher.subscribe(userIdToPusherChannel(graphStore.user.id));
  userChannel.bind("transaction-accepted", (data: any) => handlePusherMessage(data, true));
  const globalChannel = pusher.subscribe(GLOBAL_GRAPH_CHANNEL);
  globalChannel.bind("transaction-accepted", (data: any) => handlePusherMessage(data, false));
  const stopSyncing = graphStore.updateManager.startSync();
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
