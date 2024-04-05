"use client";
import { toJS } from "mobx";
import { useEffect, useState } from "react";
import { env } from "./envFrontend";
import "./global.css";
import { GraphStore } from "./model/GraphStore";
import { Bullet } from "./model/OutlineBullet";
import { RemoteGraphStore } from "./model/RemoteGraphStore";
import { ViewStore } from "./model/ViewStore";
import { GraphStoreProvider } from "./store/useGraphStore";
import { ViewStoreProvider } from "./store/useViewStore";

// Initialize stores
const graphStore = new GraphStore(env.isPersistenceEnabled ? new RemoteGraphStore() : undefined);
const loadedPromise = env.isPersistenceEnabled ? graphStore.loadFromServer() : Promise.resolve();
if (!env.isPersistenceEnabled) {
  graphStore.createRoot();
}
const appViewStore = new ViewStore(graphStore);
const outlineViewStore = appViewStore.outlineViewStore;
outlineViewStore.setRoot(
  new Bullet(outlineViewStore, graphStore.outlineRoot, graphStore.outlineRootRelationToUserRoot),
);

// Expose stores to the window for debugging
if (typeof window !== "undefined" && env.env !== "production") {
  window.mew = {
    env,
    toJS,
    graphStore,
    appViewStore,
    outlineViewStore: appViewStore.outlineViewStore,
    thoughtstreamViewStore: appViewStore.thoughtstreamViewStore,
  };
}

/**
 * The root component which wraps every page in the application
 * and provides the app stores.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    loadedPromise.then(() => setIsLoading(false));
  }, []);
  return (
    <html lang="en">
      <GraphStoreProvider value={graphStore}>
        <ViewStoreProvider value={appViewStore}>
          <body>{isLoading ? <div>Loading...</div> : children}</body>
        </ViewStoreProvider>
      </GraphStoreProvider>
    </html>
  );
}
