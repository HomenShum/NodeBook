"use client";
import axios from "axios";
import { getDependencyTree, getObserverTree, toJS } from "mobx";
import React, { useEffect, useState } from "react";
import { useAsyncEffect } from "ahooks";

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
import { localLocalData } from "@/app/persistence/loadGraphData";
import { toast } from "@/app/util";
import { ViewStoreProvider } from "@/app/view/useViewStore";
import { ViewStore } from "@/app/view/ViewStore";
import { GLOBAL_USERS_NODE_ID, GLOBAL_USERS_RELATION_ID } from "@/lib/constants";
import rootLogger from "@/lib/logger";
import useSetupUser from "@/app/hooks/useSetupUser";

export const logger = rootLogger.child({ service: "store-provider" });

export function StoresProvider({
  children,
  initialObjectId,
}: Readonly<{ children: React.ReactNode; initialObjectId: string | null }>) {
  axios.defaults.headers.common["Content-Type"] = "application/json";
  const [isLoading, setIsLoading] = useState(true);
  const [settingsStore, setSettingsStore] = useState<SettingsStore | null>(null);
  const [graphStore, setGraphStore] = useState<GraphStore | null>(null);
  const [viewStore, setViewStore] = useState<ViewStore | null>(null);
  const user = useSetupUser();

  useEffect(() => {
    if (!user) return;
    const settings = new SettingsStore(user);
    const graph = new GraphStore(user, settings);
    const view = new ViewStore(settings, graph);
    setSettingsStore(settings);
    setGraphStore(graph);
    setViewStore(view);
    return () => {
      logger.debug("Cleaning up stores");
      graph.updateManager.stopSync();
      graph.cleanup();
      settings.cleanup();
      view.cleanup();
    };
  }, [user]);

  useAsyncEffect(async () => {
    if (!graphStore || !user || !settingsStore) return;
    try {
      setIsLoading(true);
      if (env.isPersistenceEnabled) {
        if (env.persistTo === "server") {
          const objectIds = [
            graphStore.relationTypesNodeId,
            GLOBAL_USERS_NODE_ID,
            GLOBAL_USERS_RELATION_ID,
            graphStore.userRootId,
            graphStore.usersToUserRelationId,
            graphStore.myHashtagsNodeId,
            graphStore.myFavoritesNodeId,
            graphStore.myStreamNodeId,
          ];
          if (initialObjectId) {
            objectIds.push(decodeURIComponent(initialObjectId));
          }
          graphStore.layerManager.clear();
          await graphStore.layerManager.initialize(objectIds);
          graphStore.updateManager.startSync();
        } else if (env.persistTo === "local") {
          localLocalData(graphStore);
        }
      }
    } catch (e) {
      toast("Failed to load data from server. Starting with an empty graph.");
      setGraphStore(new GraphStore(user, settingsStore));
      logger.error("Failed sync setup", e);
    } finally {
      setIsLoading(false);
    }
  }, [graphStore, settingsStore, user]);

  useEffect(() => {
    if (!viewStore) return;
    viewStore.startObservingMouse();
    return () => {
      viewStore.stopObservingMouse();
    };
  }, [viewStore]);

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

  if (!user || !viewStore || !graphStore || !settingsStore) {
    return <></>;
  }

  return (
    <LoadingContext.Provider value={isLoading}>
      <UserContext.Provider value={user}>
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
