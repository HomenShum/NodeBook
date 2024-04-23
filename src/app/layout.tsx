"use client";
import { toJS } from "mobx";
import { useEffect, useState } from "react";
import { ViewController } from "./controller/ViewController";
import { ViewControllerProvider } from "./controller/useViewController";
import { env } from "./envFrontend";
import "./global.css";
import { GraphStore } from "./model/GraphStore";
import { GraphStoreProvider } from "./store/useGraphStore";

// Initialize stores
const graphStore = new GraphStore();
const loadedPromise = Promise.resolve();
const viewController = new ViewController(graphStore);

// Expose stores to the window for debugging
if (typeof window !== "undefined" && env.env !== "production") {
  window.mew = {
    env,
    toJS,
    graphStore,
    viewController,
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
        <ViewControllerProvider value={viewController}>
          <body>{isLoading ? <div>Loading...</div> : children}</body>
        </ViewControllerProvider>
      </GraphStoreProvider>
    </html>
  );
}
