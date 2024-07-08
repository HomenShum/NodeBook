"use client";
import { autorun, getDependencyTree, getObserverTree, toJS } from "mobx";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { DataLoadProvider } from "@/app/DataLoadContext";
import { env } from "@/app/envFrontend";
import { GraphStore } from "@/app/graph/GraphStore";
import { SettingsStore } from "@/app/graph/SettingsStore";
import { GraphStoreProvider } from "@/app/graph/useGraphStore";
import { SettingsStoreProvider } from "@/app/graph/useSettingsStore";
import { loadGraphData } from "@/app/persistence/loadGraphData";
import { persistGraphData } from "@/app/persistence/persistGraphData";
import { storesToDataString } from "@/app/persistence/serialization";
import { RenderController } from "@/app/render/RenderController";
import { RenderControllerProvider } from "@/app/render/useRenderController";
import { toast, useCurView } from "@/app/util";
import { ViewStore } from "@/app/view/ViewStore";
import { ViewStoreProvider } from "@/app/view/useViewStore";
import "./global.css";

const App = dynamic(() => import("./App"), {
  ssr: false,
});

// Initialize stores
const settingsStore = new SettingsStore();
settingsStore.loadFromLocalStorage();
const graphStore = new GraphStore(settingsStore);

const viewStore = new ViewStore(settingsStore, graphStore);
const renderController = new RenderController();
// Initialize with blank entries in thoughtstream and outline
graphStore.addChildNode({ parentId: graphStore.outlineRoot.id }).then(({ node }) => {
  graphStore.addToThoughtstream(node);
});

autorun(() => {
  settingsStore.saveToLocalStorage();
});

// Expose stores to the window for debuggingf
if (typeof window !== "undefined" && env.env !== "production") {
  window.mew = {
    env,
    toJS,
    graphStore,
    viewStore,
    renderController,
    getDependencyTree,
    getObserverTree,
  };
}

/**
 * The root component which wraps every page in the application
 * and provides the app stores.
 */
export default function RootTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const isLoadingRef = useRef(false);
  const persistedData = useRef<string | null>(null);
  const curView = useCurView();

  useEffect(() => {
    if (!env.isPersistenceEnabled) {
      setHasLoaded(true);
      return;
    }
    if (isLoadingRef.current) return;
    async function setupSync() {
      try {
        isLoadingRef.current = true;
        await loadGraphData(graphStore, viewStore);
      } catch (e) {
        graphStore.clear();
        viewStore.clear();
        toast("Failed to load data from server. Starting with an empty graph.");
        throw e;
      } finally {
        setHasLoaded(true);
        isLoadingRef.current = false;
        setInterval(() => {
          const newDataString = storesToDataString(graphStore, viewStore);
          if (newDataString !== persistedData.current) {
            persistedData.current = newDataString;
            persistGraphData(newDataString);
          }
        }, 500);
      }
    }
    setupSync();
  }, []);

  return (
    <html>
      <DataLoadProvider value={hasLoaded}>
        <SettingsStoreProvider value={settingsStore}>
          <GraphStoreProvider value={graphStore}>
            <ViewStoreProvider value={viewStore}>
              <RenderControllerProvider value={renderController}>
                <body>
                  <App curView={curView}>{children}</App>
                </body>
              </RenderControllerProvider>
            </ViewStoreProvider>
          </GraphStoreProvider>
        </SettingsStoreProvider>
      </DataLoadProvider>
    </html>
  );
}
