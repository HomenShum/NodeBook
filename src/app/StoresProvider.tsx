"use client";
import { getDependencyTree, getObserverTree, toJS } from "mobx";
import React, { useEffect, useRef, useState } from "react";

import { UNLOGGED_USER } from "@/app/auth/MewUser";
import { GraphStoreProvider } from "@/app/contexts/GraphStoreContext";
import { LoadingContext } from "@/app/contexts/LoadingContext";
import { NotificationProvider } from "@/app/contexts/NotificationContext";
import { SettingsStoreContext } from "@/app/contexts/SettingsStoreContext";
import { SlugProvider } from "@/app/contexts/SlugContext";
import { UserContext } from "@/app/contexts/UserContext";
import { VoiceInputProvider } from "@/app/contexts/VoiceInputContext";
import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import useSetupUser from "@/app/hooks/useSetupUser";
import { useToast } from "@/app/hooks/useToast";
import { localLocalData } from "@/app/persistence/loadGraphData";
import { toast } from "@/app/util";
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
  const [firstRender, setFirstRender] = useState(true);

  // instantiate empty stores with unlogged user
  const user = useSetupUser();
  const [settingsStore, setSettingsStore] = useState<SettingsStore>(
    new SettingsStore(user === null ? UNLOGGED_USER : user),
  );
  const [graphStore, setGraphStore] = useState<GraphStore>(new GraphStore(UNLOGGED_USER, settingsStore));
  const [viewStore, setViewStore] = useState<ViewStore>(new ViewStore(settingsStore, graphStore));
  const { addToast } = useToast();
  const renderCounter = useRef(0);

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
    if (!user || renderCounter.current > 1) return;
    let ignore = false;
    async function setupStores() {
      let syncCleanup = () => {};
      if (!user) return syncCleanup;
      logger.debug("Starting to setup stores");
      if (firstRender) {
        setFirstRender(false);
        setIsLoading(true);
      }

      // create new stores (shorter names to distinguish from the state variables)
      const settings = new SettingsStore(user);
      let graph = new GraphStore(user, settings, addToast);
      const view = new ViewStore(settings, graph);

      // load and start sync
      try {
        if (env.isPersistenceEnabled) {
          if (env.persistTo === "server") {
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
            await graph.layerManager.initialize(objectIds);
            renderCounter.current++;
          } else if (env.persistTo === "local") {
            localLocalData(graph);
          }
        }
      } catch (e) {
        toast("Failed to load data from server. Starting with an empty graph.");
        graph = new GraphStore(user, settings, addToast);
        logger.error("Failed sync setup", e);
      }

      // Set up stores. (unless we are unmounting, in which case ignore the result)
      if (ignore) return;
      logger.debug("Starting sync");
      syncCleanup = graph.updateManager.startSync();
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
  }, [initialObjectId, user]);

  useEffect(() => {
    viewStore.startObservingMouse();
    return () => {
      viewStore.stopObservingMouse();
    };
  }, [viewStore]);

  return (
    <LoadingContext.Provider value={isLoading}>
      <UserContext.Provider value={user || UNLOGGED_USER}>
        <SettingsStoreContext.Provider value={settingsStore}>
          <GraphStoreProvider value={graphStore}>
            <ViewStoreProvider value={viewStore}>
              <SlugProvider>
                <NotificationProvider>
                  <VoiceInputProvider>{children}</VoiceInputProvider>
                </NotificationProvider>
              </SlugProvider>
            </ViewStoreProvider>
          </GraphStoreProvider>
        </SettingsStoreContext.Provider>
      </UserContext.Provider>
    </LoadingContext.Provider>
  );
}
