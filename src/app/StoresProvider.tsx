"use client";
import { getDependencyTree, getObserverTree, toJS } from "mobx";
import React, { useEffect, useState } from "react";

import { GraphStoreProvider } from "@/app/contexts/GraphStoreContext";
import { LoadingContext } from "@/app/contexts/LoadingContext";
import { NotificationProvider } from "@/app/contexts/NotificationContext";
import { SettingsStoreContext } from "@/app/contexts/SettingsStoreContext";
import { SlugProvider } from "@/app/contexts/SlugContext";
import { useUser } from "@/app/contexts/UserContext";
import { VoiceInputProvider } from "@/app/contexts/VoiceInputContext";
import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { ConvexSyncBridge } from "@/app/graph/ConvexSyncBridge";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { ViewStoreProvider } from "@/app/view/useViewStore";
import { ViewStore } from "@/app/view/ViewStore";
import { GLOBAL_USERS_NODE_ID, GLOBAL_USERS_RELATION_ID } from "@/lib/constants";
import rootLogger from "@/lib/logger";

export const logger = rootLogger.child({ service: "store-provider" });

export function StoresProvider({
  children,
  initialObjectId,
}: Readonly<{ children: React.ReactNode; initialObjectId: string | null }>) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const user = useUser();

  // instantiate empty stores with unlogged user
  const [settingsStore, setSettingsStore] = useState<SettingsStore | null>(null);
  const [graphStore, setGraphStore] = useState<GraphStore | null>(null);
  const [viewStore, setViewStore] = useState<ViewStore | null>(null);

  // expose stores to window for debugging
  if (env.env !== "production" && typeof window !== "undefined") {
    window.nodebook = {
      env,
      toJS,
      graphStore,
      viewStore,
      getDependencyTree,
      getObserverTree,
      rootLogger,
    };
    window.nodebook = window.nodebook;
  }

  // when auth changes, clean up current stores and setup up new ones
  useEffect(() => {
    if (!user) return;
    let ignore = false;
    const setupController = new AbortController();
    const navigationStartedAt = typeof performance === "undefined" ? Date.now() : performance.timeOrigin;
    document.documentElement.dataset.nodebookHydrationState = "loading";
    delete document.documentElement.dataset.nodebookHydrationMs;
    async function setupStores() {
      let syncCleanup = () => {};
      if (!user) return syncCleanup;
      logger.debug("Starting to setup stores");
      setIsLoading(true);
      setLoadError(null);

      // create new stores (shorter names to distinguish from the state variables)
      const settings = new SettingsStore(user);
      const graph = new GraphStore(user, settings);
      const view = new ViewStore(settings, graph);

      // load and start sync
      try {
        if (env.isPersistenceEnabled && !user.isAnonymous) {
          {
            const objectIds = [
              decodeURIComponent(initialObjectId || "home"),
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
            await graph.layerManager.initialize(objectIds, setupController.signal);
          }
        }
      } catch (e) {
        logger.error("Failed sync setup", e);
        if (!ignore) {
          document.documentElement.dataset.nodebookHydrationState = "error";
          setLoadError("NodeBook could not load your notebook. Your stored data was not changed.");
          setIsLoading(false);
        }
        graph.cleanup();
        settings.cleanup();
        view.cleanup();
        return syncCleanup;
      }

      // Set up stores. (unless we are unmounting, in which case ignore the result)
      if (ignore) return;
      logger.debug("Starting sync");
      syncCleanup = user.isAnonymous ? () => {} : graph.updateManager.startSync();
      setGraphStore(graph);
      setSettingsStore(settings);
      setViewStore(view);
      setIsLoading(false);
      document.documentElement.dataset.nodebookHydrationState = "ready";
      document.documentElement.dataset.nodebookHydrationMs = String(Math.round(Date.now() - navigationStartedAt));
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
      setupController.abort("Store setup superseded");
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [initialObjectId, retryNonce, user]);

  useEffect(() => {
    viewStore && viewStore.startObservingMouse();
    return () => {
      viewStore && viewStore.stopObservingMouse();
    };
  }, [viewStore]);

  if (loadError) {
    return (
      <main
        aria-labelledby="nodebook-load-error-title"
        data-testid="notebook-load-error"
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "100vh",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <h1 id="nodebook-load-error-title">Notebook unavailable</h1>
        <p>{loadError}</p>
        <button type="button" onClick={() => setRetryNonce((value) => value + 1)}>
          Retry
        </button>
      </main>
    );
  }

  if (!settingsStore || !viewStore || !graphStore) {
    return (
      <main aria-busy="true" aria-label="Loading notebook">
        Loading notebook…
      </main>
    );
  }

  return (
    <LoadingContext.Provider value={isLoading}>
      <SettingsStoreContext.Provider value={settingsStore}>
        <GraphStoreProvider value={graphStore}>
          <ViewStoreProvider value={viewStore}>
            <SlugProvider>
              <NotificationProvider>
                {env.isPersistenceEnabled && !user.isAnonymous && <ConvexSyncBridge graphStore={graphStore} />}
                <VoiceInputProvider>{children}</VoiceInputProvider>
              </NotificationProvider>
            </SlugProvider>
          </ViewStoreProvider>
        </GraphStoreProvider>
      </SettingsStoreContext.Provider>
    </LoadingContext.Provider>
  );
}
