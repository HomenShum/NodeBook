"use client";
import { getDependencyTree, getObserverTree, toJS } from "mobx";
import React, { useEffect, useState } from "react";

import { MewUser, MOCK_MEW_USER, UNLOGGED_USER } from "@/app/auth/MewUser";
import { useAuth } from "@/app/auth/useAuth";
import { GraphStoreProvider } from "@/app/contexts/GraphStoreContext";
import { LoadingContext } from "@/app/contexts/LoadingContext";
import { NotificationProvider } from "@/app/contexts/NotificationContext";
import { SettingsStoreContext } from "@/app/contexts/SettingsStoreContext";
import { SlugProvider } from "@/app/contexts/SlugContext";
import { UserContext } from "@/app/contexts/UserContext";
import { env } from "@/app/envFrontend";
import { JWT_LOCAL_STORAGE_KEY } from "@/app/graph/constants";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { fetchGetOrCreateUser, fetchGetUser, localLocalData } from "@/app/persistence/loadGraphData";
import { getAuthFetch, toast } from "@/app/util";
import { ViewStoreProvider } from "@/app/view/useViewStore";
import { ViewStore } from "@/app/view/ViewStore";
import { GLOBAL_USERS_NODE_ID, GLOBAL_USERS_RELATION_ID } from "@/lib/constants";
import rootLogger from "@/lib/logger";

export const logger = rootLogger.child({ service: "store-provider" });

const envAllowsMockAuth = () => {
  return env.env === "development" || env.env === "preview";
};

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
      const objectId = (window && window.location.pathname.split("/").pop()) || "home";
      if (!auth && !envAllowsMockAuth()) return logger.debug("Skip loading stores while auth is not enabled");
      if (auth?.isLoading) return logger.debug("Skip loading stores while auth is loading");

      logger.debug("Starting to setup stores", { ...auth });
      setIsLoading(true);

      if (auth && auth.user) {
        localStorage.setItem(JWT_LOCAL_STORAGE_KEY, await auth.getAccessTokenSilently());
      }

      const authedFetch = getAuthFetch();

      // load user
      logger.debug("Loading user");
      let user: MewUser;
      try {
        if (!auth && envAllowsMockAuth()) {
          user = MOCK_MEW_USER;
        } else if (auth?.user) {
          const data = await fetchGetOrCreateUser(auth.user, authedFetch);
          if (!data) throw new Error("fetchGetOrCreateUser returned null");
          user = new MewUser({ ...data });
        } else if (env.env !== "production" && env.hardcodedUserId) {
          const data = await fetchGetUser(authedFetch);
          if (!data) throw new Error("fetchGetUser returned null");
          user = new MewUser({ ...data });
        } else {
          user = UNLOGGED_USER;
        }
      } catch (e) {
        logger.error("Failed to get or create user, using unlogged user", e);
        user = UNLOGGED_USER;
      }

      // create new stores (shorter names to distinguish from the state variables)
      const settings = new SettingsStore(user.settings, async (newSettings) => {
        if (user.isAnonymous || !env.isPersistenceEnabled) return;
        const userData = { ...user, settings: newSettings };
        try {
          await authedFetch("/api/user/settings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ user: userData }),
          });
        } catch (e) {
          logger.error("Failed to save user settings", e);
        }
      });
      let graph = new GraphStore(user, settings, authedFetch);
      const view = new ViewStore(settings, graph);

      // load and start sync
      let syncCleanup = () => {};
      try {
        if (env.isPersistenceEnabled) {
          if (env.persistTo === "server") {
            const objectIds = [
              objectId,
              graph.relationTypesNodeId,
              GLOBAL_USERS_NODE_ID,
              GLOBAL_USERS_RELATION_ID,
              graph.userRootId,
              graph.usersToUserRelationId,
              graph.myHashtagsNodeId,
              graph.myFavoritesNodeId,
              graph.myStreamNodeId,
            ];

            graph.layerManager.clear();
            await graph.layerManager.initialize(objectIds);
          } else if (env.persistTo === "local") {
            localLocalData(graph);
          }
        }
      } catch (e) {
        toast("Failed to load data from server. Starting with an empty graph.");
        graph = new GraphStore(user, settings, authedFetch);
        logger.error("Failed sync setup", e);
      }

      // Set up stores. (unless we are unmounting, in which case ignore the result)
      if (ignore) return;
      logger.debug("Starting sync");
      syncCleanup = graph.updateManager.startSync();
      setUser(user);
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

  useEffect(() => {
    viewStore.startObservingMouse();
    return () => {
      viewStore.stopObservingMouse();
    };
  }, [viewStore]);

  return (
    <LoadingContext.Provider value={isLoading}>
      <UserContext.Provider value={user}>
        <SettingsStoreContext.Provider value={settingsStore}>
          <GraphStoreProvider value={graphStore}>
            <ViewStoreProvider value={viewStore}>
              <SlugProvider>
                <NotificationProvider>{children}</NotificationProvider>
              </SlugProvider>
            </ViewStoreProvider>
          </GraphStoreProvider>
        </SettingsStoreContext.Provider>
      </UserContext.Provider>
    </LoadingContext.Provider>
  );
}
