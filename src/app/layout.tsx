"use client";
import { autorun, getDependencyTree, getObserverTree, toJS } from "mobx";
import dynamic from "next/dynamic";
import { Inter } from "next/font/google";
import Pusher from "pusher-js";
import { useEffect, useRef, useState } from "react";

import { AuthProvider } from "@/app/auth/AuthProvider";
import { useAuth } from "@/app/auth/useAuth";
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
import { SerializedSyncDataSchema } from "@/app/sync/SyncTask";
import { toast } from "@/app/util";
import { ViewStore } from "@/app/view/ViewStore";
import { ViewStoreProvider } from "@/app/view/useViewStore";
import "./global.css";

const App = dynamic(() => import("./App"), {
  ssr: false,
});

// Initialize stores
const settingsStore = new SettingsStore();
settingsStore.loadFromLocalStorage();
const graphStore = new GraphStore();
const viewStore = new ViewStore(settingsStore, graphStore);
const renderController = new RenderController();

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

// Loading main font
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

/**
 * The root component which wraps every page in the application
 * and provides the app stores.
 */
export default function RootTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={inter.className}>
      <AuthProvider>
        <RootTemplateInternals>{children}</RootTemplateInternals>
      </AuthProvider>
    </html>
  );
}

function RootTemplateInternals({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, authFetch } = useAuth();
  const [hasLoaded, setHasLoaded] = useState(false);
  const isLoadingRef = useRef(false);
  const persistedData = useRef<string | null>(null);

  // TODO : hide persistence behind auth
  useEffect(() => {
    if (user.isUnlogged || hasLoaded) return;
    graphStore.initialize(user);

    if (!env.isPersistenceEnabled) {
      // Initialize with blank entries in thoughtstream and outline
      if (graphStore.outlineRoot.children.length === 0) {
        graphStore.addChildNode({ parentId: graphStore.outlineRoot.id });
      }
      setHasLoaded(true);
      return;
    }

    if (isLoadingRef.current) return;
    async function setupSync() {
      try {
        isLoadingRef.current = true;
        await loadGraphData(graphStore, viewStore, authFetch);
      } catch (e) {
        graphStore.initialize(user);
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
        if (env.persistTo !== "server") return;
        const pusher = new Pusher(env.pusherKey, {
          cluster: env.pusherCluster,
        });
        const channel = pusher.subscribe("mew-sync-channel");
        channel.bind("transaction-accepted", (data: any) => {
          const parsed = SerializedSyncDataSchema.safeParse(data);
          if (!parsed.success) {
            console.error("Invalid sync data received", data);
            return;
          }
          graphStore.handleSyncData(parsed.data);
        });
        graphStore.startSync(authFetch);
      }
    }
    setupSync();
  }, [user, authFetch, hasLoaded]);

  return (
    <SettingsStoreProvider value={settingsStore}>
      <GraphStoreProvider value={graphStore}>
        <ViewStoreProvider value={viewStore}>
          <RenderControllerProvider value={renderController}>
            <body>
              <App>{children}</App>
            </body>
          </RenderControllerProvider>
        </ViewStoreProvider>
      </GraphStoreProvider>
    </SettingsStoreProvider>
  );
}
