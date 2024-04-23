"use client";
import { toJS } from "mobx";
import { useEffect, useRef, useState } from "react";
import { ViewController } from "./controller/ViewController";
import { ViewControllerProvider } from "./controller/useViewController";
import { env } from "./envFrontend";
import "./global.css";
import { GraphStore } from "./model/GraphStore";
import { GraphStoreProvider } from "./store/useGraphStore";

// Initialize stores
const graphStore = new GraphStore();
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

function persistData(dataString: string) {
  fetch("/api/persist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: dataString }),
  });
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
  const persistedData = useRef<string | null>(null);
  useEffect(() => {
    if (!env.isPersistenceEnabled) {
      setIsLoading(false);
      return;
    }

    fetch("/api/persist")
      .then((res) => res.json())
      .then((json) => {
        const dataString: string = json.data;
        persistedData.current = dataString;
        if (dataString !== null) {
          graphStore.deserializeInPlace(JSON.parse(dataString));
        }

        setIsLoading(false);
        setInterval(() => {
          const newDataString = JSON.stringify(graphStore.serialize());
          if (newDataString !== persistedData.current) {
            persistedData.current = newDataString;
            persistData(newDataString);
          }
        }, 500);
      });
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
